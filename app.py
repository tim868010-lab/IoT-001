import sqlite3
from flask import Flask, request, jsonify, render_template

app = Flask(__name__)
DB_FILE = 'database.db'

def init_db():
    """Initialize the SQLite database and create the energy_logs table if it doesn't exist."""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS energy_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_name TEXT NOT NULL,
            power_consumption REAL NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

# Initialize the database when the app starts
init_db()

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/')
def index():
    """Serve the frontend dashboard."""
    return render_template('index.html')

@app.route('/api/data', methods=['POST'])
def add_data():
    """Receive energy data from devices and store it in the database."""
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
    """Retrieve the latest energy logs for the dashboard."""
    limit = request.args.get('limit', 50, type=int)
    
    conn = get_db_connection()
    # Get the latest records and group them by device
    logs = conn.execute(
        'SELECT device_name, power_consumption, timestamp FROM energy_logs ORDER BY timestamp DESC LIMIT ?', 
        (limit,)
    ).fetchall()
    conn.close()
    
    # Format data for JSON response
    # We will reverse the list so it's chronologically ordered for the chart
    result = []
    for log in reversed(logs):
        result.append({
            'device_name': log['device_name'],
            'power_consumption': log['power_consumption'],
            'timestamp': log['timestamp']
        })
        
    return jsonify(result)

if __name__ == '__main__':
    # Run the Flask app on host 0.0.0.0 to allow external access (e.g. from the simulator)
    app.run(host='0.0.0.0', port=5000, debug=True)
