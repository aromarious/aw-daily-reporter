import re

config = {
    "project_map": {
        "[Cc]lawd|[Mm]olt": "openclaw",
        "activitywatch|aw-.*": "aw-daily-reporter",
        "company-research.*": "Company Research",
        "tars.*": "TARS",
        "家族|友人": "",
    }
}

test_path = "/Volumes/ExtremePro/Users/aromarious/Garage/ActivityWatch/aw-daily-reporter"
project_map = config.get("project_map", {})

print(f"Testing path: {test_path}")

for pattern, target_project in project_map.items():
    regex = re.compile(pattern)
    match = regex.search(test_path)
    if match:
        print(f"Matched pattern: {pattern}")
        print(f"Result: {target_project or 'None'}")
