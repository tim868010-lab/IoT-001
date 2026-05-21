import sqlite3
from flask import Flask, request, jsonify, render_template, session, redirect, url_for
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = 'secret-energy-key'
DB_FILE = 'database.db'

def init_db():
    """Initialize the SQLite database, create tables, and populate default users."""
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
