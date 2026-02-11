"""
プラグイン実行順序のテスト

プロジェクトマッピングが正しく動作するためには、
RuleMatchingProcessorがProjectMappingProcessorより先に実行される必要がある。

背景:
- ルールマッチングプラグインでプロジェクト名が設定される
- その後、プロジェクトマッピングプラグインでクライアントが割り当てられる
- 順序が逆だと、クライアント割り当てが正しく動作しない

注意: プラグインの実行順序は、システムの正常な動作に不可欠です
"""

import pytest


class TestPluginOrder:
    """プラグイン実行順序の検証テスト"""

    @pytest.fixture
    def plugin_manager(self):
        """プラグインマネージャーのフィクスチャ"""
        from aw_daily_reporter.plugins.manager import PluginManager

        return PluginManager()

    def test_rule_matching_before_project_mapping(self, plugin_manager):
        """
        RuleMatchingProcessorがProjectMappingProcessorより前に実行されることを確認

        重要度: 高
        理由: ルールで設定されたプロジェクト名に対してクライアントを割り当てるため
        """
        # Arrange & Act: プロセッサの順序を取得
        processors = plugin_manager._get_ordered_plugins(plugin_manager.processors)
        processor_ids = [p.plugin_id for p in processors]

        # Assert: RuleMatchingProcessorがProjectMappingProcessorより前にあることを確認
        rule_matching_id = "aw_daily_reporter.plugins.processor_rule_matching.RuleMatchingProcessor"
        project_mapping_id = "aw_daily_reporter.plugins.processor_project_mapping.ProjectMappingProcessor"

        if rule_matching_id in processor_ids and project_mapping_id in processor_ids:
            rule_matching_index = processor_ids.index(rule_matching_id)
            project_mapping_index = processor_ids.index(project_mapping_id)

            assert rule_matching_index < project_mapping_index, (
                f"RuleMatchingProcessor (index {rule_matching_index}) must come before "
                f"ProjectMappingProcessor (index {project_mapping_index}). "
                f"Current order: {processor_ids}"
            )

    def test_project_extractor_before_rule_matching(self, plugin_manager):
        """
        ProjectExtractionProcessorがRuleMatchingProcessorより前に実行されることを確認

        重要度: 中
        理由: プロジェクト抽出が先に行われ、その結果に対してルールマッチングが適用される
        """
        # Arrange & Act
        processors = plugin_manager._get_ordered_plugins(plugin_manager.processors)
        processor_ids = [p.plugin_id for p in processors]

        # Assert
        extractor_id = "aw_daily_reporter.plugins.processor_project_extractor.ProjectExtractionProcessor"
        rule_matching_id = "aw_daily_reporter.plugins.processor_rule_matching.RuleMatchingProcessor"

        if extractor_id in processor_ids and rule_matching_id in processor_ids:
            extractor_index = processor_ids.index(extractor_id)
            rule_matching_index = processor_ids.index(rule_matching_id)

            assert extractor_index < rule_matching_index, (
                f"ProjectExtractionProcessor (index {extractor_index}) must come before "
                f"RuleMatchingProcessor (index {rule_matching_index}). "
                f"Current order: {processor_ids}"
            )

    def test_compression_is_last_processor(self, plugin_manager):
        """
        CompressionProcessorが最後のプロセッサとして実行されることを確認

        重要度: 高
        理由: 全ての処理が完了した後に、タイムラインを集約・圧縮する必要がある
        """
        # Arrange & Act
        processors = plugin_manager._get_ordered_plugins(plugin_manager.processors)
        processor_ids = [p.plugin_id for p in processors]

        # Assert
        compression_id = "aw_daily_reporter.plugins.processor_compression.CompressionProcessor"

        if compression_id in processor_ids:
            compression_index = processor_ids.index(compression_id)
            # Compressionは最後から2番目以降であるべき（最後はレンダラー）
            # プロセッサの中では最後であることを確認
            assert compression_index == len(processor_ids) - 1, (
                f"CompressionProcessor should be the last processor, "
                f"but it's at index {compression_index} out of {len(processor_ids)}. "
                f"Current order: {processor_ids}"
            )

    def test_correct_processor_pipeline(self, plugin_manager):
        """
        プロセッサパイプライン全体の正しい順序を確認

        期待される順序:
        1. AFKProcessor - AFK状態の処理
        2. GitScanner - Gitアクティビティのスキャン
        3. ProjectExtractionProcessor - プロジェクト名の抽出
        4. RuleMatchingProcessor - ルールに基づくカテゴリ・プロジェクトの割り当て
        5. ProjectMappingProcessor - プロジェクト名の正規化とクライアント割り当て
        6. CompressionProcessor - タイムラインの集約
        """
        # Arrange & Act
        processors = plugin_manager._get_ordered_plugins(plugin_manager.processors)
        processor_ids = [p.plugin_id for p in processors]

        # 期待される順序
        expected_order = [
            "aw_daily_reporter.plugins.processor_afk.AFKProcessor",
            "aw_daily_reporter.plugins.scanner_git.GitScanner",
            "aw_daily_reporter.plugins.processor_project_extractor.ProjectExtractionProcessor",
            "aw_daily_reporter.plugins.processor_rule_matching.RuleMatchingProcessor",
            "aw_daily_reporter.plugins.processor_project_mapping.ProjectMappingProcessor",
            "aw_daily_reporter.plugins.processor_compression.CompressionProcessor",
        ]

        # Assert: 有効なプロセッサが期待される順序と一致することを確認
        actual_order = [pid for pid in expected_order if pid in processor_ids]

        for i in range(len(actual_order) - 1):
            current = actual_order[i]
            next_proc = actual_order[i + 1]

            current_idx = processor_ids.index(current)
            next_idx = processor_ids.index(next_proc)

            assert current_idx < next_idx, (
                f"Processor order violation: {current} (index {current_idx}) "
                f"should come before {next_proc} (index {next_idx}). "
                f"Actual order: {processor_ids}"
            )
