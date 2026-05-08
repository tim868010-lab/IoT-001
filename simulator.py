import time
import random
import requests

# The URL of the Flask API
API_URL = "http://localhost:5000/api/data"

# List of devices to simulate
DEVICES = ["Device-A (Chiller)", "Device-B (Air Compressor)", "Device-C (HVAC)"]

def generate_mock_data():
    """Generates random power consumption data for a random device."""
    device = random.choice(DEVICES)
    # Simulate realistic power consumption in kW
    if "Chiller" in device:
        power = round(random.uniform(150.0, 200.0), 2)
    elif "Compressor" in device:
        power = round(random.uniform(80.0, 120.0), 2)
    else:
        power = round(random.uniform(30.0, 60.0), 2)
        
    return {
        "device_name": device,
        "power_consumption": power
    }

def run_simulation():
    print("Starting IoT Energy Simulator...")
    print(f"Target API: {API_URL}")
    print("-" * 30)
    
    while True:
        try:
            data = generate_mock_data()
            print(f"Sending data: {data}")
            
            # Send POST request to the API
            response = requests.post(API_URL, json=data)
            
            if response.status_code == 201:
                print("  -> Success")
            else:
                print(f"  -> Failed with status {response.status_code}: {response.text}")
                
        except requests.exceptions.ConnectionError:
            print("  -> Error: Could not connect to API. Is the Flask server running?")
            
        except Exception as e:
            print(f"  -> Unexpected error: {e}")
            
        # Wait a few seconds before sending the next data point
        time.sleep(random.uniform(2.0, 5.0))

if __name__ == "__main__":
    run_simulation()
