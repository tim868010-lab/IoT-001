import sqlite3
import datetime
from flask import Flask, request, jsonify, render_template, session, redirect, url_for
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = 'secret-energy-key'
DB_FILE = 'database.db'

def init_db():
    """Initialize the SQLite database, create tables, and populate default users/tickets."""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # Create energy_logs table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS energy_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_name TEXT NOT NULL,
            power_consumption REAL NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Create users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL
        )
    ''')
    
    # Create repair_tickets table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS repair_tickets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_name TEXT NOT NULL,
            description TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT '待處理',
            reported_by TEXT NOT NULL,
            handler TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            resolved_at DATETIME
        )
    ''')
    
    # Check if users table is empty to populate defaults
    cursor.execute('SELECT COUNT(*) FROM users')
    if cursor.fetchone()[0] == 0:
        default_users = [
            ('admin@school.edu', generate_password_hash('1234'), 'admin'),
            ('student@school.edu', generate_password_hash('1234'), 'student')
        ]
        cursor.executemany(
            'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
            default_users
        )
        
    # Check if repair_tickets is empty to populate some initial test history
    cursor.execute('SELECT COUNT(*) FROM repair_tickets')
    if cursor.fetchone()[0] == 0:
        default_tickets = [
            ('Device-A (Chiller)', '冷凝器水溫偏高，高溫警報器異常觸發', '已結案', 'student@school.edu', 'admin@school.edu', '2026-05-21 10:00:00', '2026-05-21 12:00:00'),
            ('Device-C (HVAC)', '出風口傳出異音，且出風量異常偏低', '待處理', 'student@school.edu', None, '2026-05-21 14:30:00', None)
        ]
        cursor.executemany(
            'INSERT INTO repair_tickets (device_name, description, status, reported_by, handler, created_at, resolved_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            default_tickets
        )
    
    conn.commit()
    conn.close()

# Initialize the database when the app starts
init_db()

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

# Helper function to check login
def is_logged_in():
    return 'username' in session

@app.route('/')
def index():
    """Serve the frontend dashboard if logged in, otherwise redirect to login."""
    if not is_logged_in():
        return redirect(url_for('login'))
    return render_template('index.html', username=session['username'], role=session['role'])

@app.route('/login', methods=['GET', 'POST'])
def login():
    """Handle user login."""
    if is_logged_in():
        return redirect(url_for('index'))
        
    error = None
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        conn = get_db_connection()
        user = conn.execute(
            'SELECT * FROM users WHERE username = ?', (username,)
        ).fetchone()
        conn.close()
        
        if user and check_password_hash(user['password'], password):
            session['username'] = user['username']
            session['role'] = user['role']
            return redirect(url_for('index'))
        else:
            error = '帳號或密碼錯誤！'
            
    return render_template('login.html', error=error)

@app.route('/logout')
def logout():
    """Handle user logout."""
    session.clear()
    return redirect(url_for('login'))

# ----------------- 報修系統路由 -----------------

@app.route('/repair')
def repair():
    """Serve the repair and maintenance page."""
    if not is_logged_in():
        return redirect(url_for('login'))
        
    conn = get_db_connection()
    # Fetch active tickets (Pending or Processing)
    active_tickets = conn.execute(
        "SELECT * FROM repair_tickets WHERE status != '已結案' ORDER BY created_at DESC"
    ).fetchall()
    
    # Fetch resolved history
    resolved_tickets = conn.execute(
        "SELECT * FROM repair_tickets WHERE status = '已結案' ORDER BY resolved_at DESC"
    ).fetchall()
    conn.close()
    
    # Available devices for reporting
    devices = ["Device-A (Chiller)", "Device-B (Air Compressor)", "Device-C (HVAC)"]
    
    return render_template(
        'repair.html', 
        username=session['username'], 
        role=session['role'],
        active_tickets=active_tickets,
        resolved_tickets=resolved_tickets,
        devices=devices
    )

@app.route('/api/repair', methods=['POST'])
def create_ticket():
    """Submit a new repair ticket (Anyone logged in)."""
    if not is_logged_in():
        return jsonify({'error': 'Unauthorized'}), 401
        
    device_name = request.form.get('device_name')
    description = request.form.get('description')
    
    if not device_name or not description:
        return jsonify({'error': '請選擇設備並填寫描述'}), 400
        
    conn = get_db_connection()
    conn.execute(
        'INSERT INTO repair_tickets (device_name, description, reported_by, status) VALUES (?, ?, ?, ?)',
        (device_name, description, session['username'], '待處理')
    )
    conn.commit()
    conn.close()
    
    return redirect(url_for('repair'))

@app.route('/api/repair/<int:ticket_id>/status', methods=['POST'])
def update_ticket_status(ticket_id):
    """Update ticket status (Admin only)."""
    if not is_logged_in():
        return jsonify({'error': 'Unauthorized'}), 401
        
    if session.get('role') != 'admin':
        return jsonify({'error': '只有管理員擁有此操作權限'}), 403
        
    new_status = request.form.get('status')
    if new_status not in ['維修中', '已結案']:
        return jsonify({'error': '無效的狀態變更'}), 400
        
    conn = get_db_connection()
    now_str = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    if new_status == '維修中':
        conn.execute(
            'UPDATE repair_tickets SET status = ?, handler = ? WHERE id = ?',
            (new_status, session['username'], ticket_id)
        )
    elif new_status == '已結案':
        conn.execute(
            'UPDATE repair_tickets SET status = ?, resolved_at = ? WHERE id = ?',
            (new_status, now_str, ticket_id)
        )
        
    conn.commit()
    conn.close()
    
    return redirect(url_for('repair'))

# ----------------- 能耗數據 API -----------------

@app.route('/api/data', methods=['POST'])
def add_data():
    """Receive energy data from devices and store it in the database (No authentication required)."""
    data = request.get_json()
    
    if not data or 'device_name' not in data or 'power_consumption' not in data:
        return jsonify({'error': 'Missing required data fields'}), 400
        
    device_name = data['device_name']
    power_consumption = float(data['power_consumption'])
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        'INSERT INTO energy_logs (device_name, power_consumption) VALUES (?, ?)',
        (device_name, power_consumption)
    )
    conn.commit()
    conn.close()
    
    return jsonify({'message': 'Data inserted successfully'}), 201

@app.route('/api/data', methods=['GET'])
def get_data():
    """Retrieve the latest energy logs for the dashboard (Authentication required)."""
    if not is_logged_in():
        return jsonify({'error': 'Unauthorized'}), 401
        
    limit = request.args.get('limit', 50, type=int)
    
    conn = get_db_connection()
    logs = conn.execute(
        'SELECT device_name, power_consumption, timestamp FROM energy_logs ORDER BY timestamp DESC LIMIT ?', 
        (limit,)
    ).fetchall()
    conn.close()
    
    result = []
    for log in reversed(logs):
        result.append({
            'device_name': log['device_name'],
            'power_consumption': log['power_consumption'],
            'timestamp': log['timestamp']
        })
        
    return jsonify(result)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
