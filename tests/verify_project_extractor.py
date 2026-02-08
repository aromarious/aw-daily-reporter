import unittest

from aw_daily_reporter.plugins.processor_project_extractor import (
    ProjectExtractionProcessor,
)


class TestProjectExtractor(unittest.TestCase):
    def test_extraction(self):
        processor = ProjectExtractionProcessor()
        patterns = [r"^(?P<project>.+?)\|"]
        config = {
            "settings": {"project_extraction_patterns": patterns},
            "apps": {"editors": ["code"]},
        }

        # Case 1: Editor, matching title -> Extract
        item_1 = {
            "title": "MyProject | file.py",
            "app": "VS Code",
            "timestamp": 0,
            "duration": 10,
            "project": None,
        }

        # Case 2: Source already set -> Skip
        item_2 = {
            "title": "MyProject | file.py",
            "app": "VS Code",
            "timestamp": 0,
            "duration": 10,
            "project": "ExistingProject",
        }

        # Case 3: Not an editor -> Skip
        item_3 = {
            "title": "MyProject | docs",
            "app": "Chrome",
            "timestamp": 0,
            "duration": 10,
            "project": None,
        }

        timeline = [item_1, item_2, item_3]
        result = processor.process(timeline, config)

        assert result[0]["project"] == "MyProject"
        assert result[1]["project"] == "ExistingProject"  # Should not be overwritten
        assert result[2]["project"] is None


if __name__ == "__main__":
    unittest.main()
