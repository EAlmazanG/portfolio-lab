import urllib.request
import urllib.error
import time
import sys

def check_service(name, url, retries=5):
    print(f"Checking {name} at {url}...")
    for i in range(retries):
        try:
            with urllib.request.urlopen(url) as response:
                if response.status == 200:
                    print(f"✅ {name} is UP!")
                    return True
        except urllib.error.URLError as e:
            print(f"⚠️  Attempt {i+1}/{retries} failed: {e}")
            time.sleep(2)
        except Exception as e:
            print(f"❌ Error checking {name}: {e}")
            return False
    
    print(f"❌ {name} is DOWN after {retries} attempts.")
    return False

def main():
    print("Starting Infrastructure Health Check...")
    
    # Check Backend Health (API)
    backend_ok = check_service("Backend API", "http://localhost:8000/api/v1/health")
    
    # Check Frontend (Main Page)
    frontend_ok = check_service("Frontend App", "http://localhost:3001")
    
    if backend_ok and frontend_ok:
        print("\n🎉 All systems operational!")
        sys.exit(0)
    else:
        print("\n🔥 Some systems failed to start.")
        sys.exit(1)

if __name__ == "__main__":
    main()

