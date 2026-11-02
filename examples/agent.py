"""use the hosted api at enganything.com from a python script or agent"""

import requests
import time
import sys

API = "https://enganything.com"

def scan(url, scope="full", depth="standard"):
    resp = requests.post(f"{API}/api/run", json={
        "url": url,
        "scope": scope,
        "depth": depth,
    })
    resp.raise_for_status()
    run_id = resp.json()["runId"]
    print(f"scan started: {run_id}")

    while True:
        time.sleep(2)
        result = requests.get(f"{API}/api/getRun", params={"id": run_id}).json()
        if result["status"] == "complete":
            return result
        elif result["status"] == "error":
            raise Exception(result.get("error", "scan failed"))
        steps = result.get("steps", [])
        if steps:
            print(f"  {steps[-1]}")

if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else "https://example.com"
    result = scan(url)
    print(f"\ndone in {result['elapsed']}s")
    for stat in result.get("stats", []):
        print(f"  {stat['value']} {stat['label']}")
    filename = f"reconstruction-{result['domain']}.md"
    with open(filename, "w") as f:
        f.write(result["result"])
    print(f"saved to {filename}")

