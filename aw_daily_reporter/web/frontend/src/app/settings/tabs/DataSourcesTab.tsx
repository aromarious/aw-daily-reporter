"use client"

import { Database, Loader2 } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import useSWR from "swr"
import { Card } from "@/components/Card"
import { useTranslation } from "@/contexts/I18nContext"
import { fetcher } from "@/lib/api"
import type { FullConfig } from "../types"

interface Bucket {
  id: string
  name: string
  type: string
  hostname: string
  created: string
}

interface DataSourcesTabProps {
  config: FullConfig | undefined
  handleSaveConfig: (
    newConfig: FullConfig | null,
    showNotification?: boolean,
    immediate?: boolean,
  ) => Promise<boolean>
}

export default function DataSourcesTab({
  config,
  handleSaveConfig,
}: DataSourcesTabProps) {
  const { t } = useTranslation()
  const [enabledBucketIds, setEnabledBucketIds] = useState<string[]>([])
  const [allEnabled, setAllEnabled] = useState(true)

  // バケット一覧を取得
  const {
    data: bucketsData,
    error: bucketsError,
    isLoading,
  } = useSWR<{ buckets: Bucket[] }>("/api/buckets", fetcher)

  const buckets = bucketsData?.buckets || []
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // 設定からenabledBucketIdsを初期化
  useEffect(() => {
    if (config?.system?.enabled_bucket_ids) {
      const ids = config.system.enabled_bucket_ids
      // "__DISABLED__" は全オフを表す特殊マーカー
      if (ids.length === 1 && ids[0] === "__DISABLED__") {
        setEnabledBucketIds([])
        setAllEnabled(false)
      } else if (ids.length === 0) {
        // 空配列は全オン（デフォルト）
        setEnabledBucketIds([])
        setAllEnabled(true)
      } else {
        // 個別選択
        setEnabledBucketIds(ids)
        setAllEnabled(false)
      }
    } else {
      setEnabledBucketIds([])
      setAllEnabled(true)
    }
  }, [config])

  // 自動保存（デバウンス付き）
  const autoSave = useCallback(
    (newAllEnabled: boolean, newEnabledBucketIds: string[]) => {
      if (!config) return

      // 既存のタイマーをクリア
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      // 1秒後に保存
      saveTimeoutRef.current = setTimeout(async () => {
        // 保存する値を決定
        let bucketIdsToSave: string[]
        if (newAllEnabled) {
          bucketIdsToSave = []
        } else if (newEnabledBucketIds.length === 0) {
          bucketIdsToSave = ["__DISABLED__"]
        } else {
          bucketIdsToSave = newEnabledBucketIds
        }

        const newConfig = {
          ...config,
          system: {
            ...config.system,
            enabled_bucket_ids: bucketIdsToSave,
          },
        }

        await handleSaveConfig(newConfig, true, true)
      }, 1000)
    },
    [config, handleSaveConfig],
  )

  const handleToggleBucket = (bucketId: string) => {
    if (allEnabled) {
      // 全選択状態から個別選択に切り替え
      const newIds = buckets.map((b) => b.id).filter((id) => id !== bucketId)
      setEnabledBucketIds(newIds)
      setAllEnabled(false)
      autoSave(false, newIds)
    } else {
      if (enabledBucketIds.includes(bucketId)) {
        const newIds = enabledBucketIds.filter((id) => id !== bucketId)
        setEnabledBucketIds(newIds)
        autoSave(false, newIds)
      } else {
        const newIds = [...enabledBucketIds, bucketId]
        setEnabledBucketIds(newIds)
        // すべてのバケットが選択されたら全選択状態に
        if (newIds.length === buckets.length) {
          setEnabledBucketIds([])
          setAllEnabled(true)
          autoSave(true, [])
        } else {
          autoSave(false, newIds)
        }
      }
    }
  }

  const handleToggleAll = () => {
    if (allEnabled) {
      // 全選択 → 全解除
      setEnabledBucketIds([])
      setAllEnabled(false)
      autoSave(false, [])
    } else {
      // 部分選択/全解除 → 全選択
      setEnabledBucketIds([])
      setAllEnabled(true)
      autoSave(true, [])
    }
  }

  const isBucketEnabled = (bucketId: string) => {
    if (allEnabled) return true
    return enabledBucketIds.includes(bucketId)
  }

  return (
    <div className="h-full flex flex-col gap-4">
      <Card
        title={t("Data Sources")}
        icon={<Database size={18} className="text-primary" />}
        className="flex-1 flex flex-col min-h-0"
      >
        <div className="flex-1 flex flex-col min-h-0">
          <p className="text-sm text-base-content/60 mb-4 px-1">
            {t(
              "Select which ActivityWatch buckets to use for report generation. Unchecked buckets will be ignored.",
            )}
          </p>

          {bucketsError && (
            <div className="text-error text-sm mb-4">
              {t("Failed to load buckets:")} {bucketsError.message}
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin mr-2" size={20} />
              {t("Loading buckets...")}
            </div>
          )}

          {!isLoading && buckets.length === 0 && (
            <div className="text-base-content/60 text-sm text-center py-8">
              {t("No buckets found. Make sure ActivityWatch is running.")}
            </div>
          )}

          {!isLoading && buckets.length > 0 && (
            <>
              {/* 全選択トグル */}
              <div className="mb-3 pb-3 border-b border-base-content/10">
                <label className="flex items-center gap-3 cursor-pointer hover:bg-base-200/50 p-2 rounded-lg transition-colors">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary checkbox-sm"
                    checked={
                      allEnabled || enabledBucketIds.length === buckets.length
                    }
                    onChange={handleToggleAll}
                  />
                  <div className="flex-1">
                    <div className="font-medium text-base-content">
                      {allEnabled || enabledBucketIds.length === buckets.length
                        ? t("All Data Sources (Default)")
                        : t("Select All")}
                    </div>
                    <div className="text-xs text-base-content/50">
                      {allEnabled
                        ? t("All available buckets will be used")
                        : `${enabledBucketIds.length} / ${buckets.length} ${t("selected")}`}
                    </div>
                  </div>
                </label>
              </div>

              {/* バケット一覧 */}
              <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
                {buckets.map((bucket) => (
                  <label
                    key={bucket.id}
                    className="flex items-center gap-3 cursor-pointer hover:bg-base-200/50 p-2 rounded-lg transition-colors"
                  >
                    <input
                      type="checkbox"
                      className="checkbox checkbox-primary checkbox-sm"
                      checked={isBucketEnabled(bucket.id)}
                      onChange={() => handleToggleBucket(bucket.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-base-content truncate">
                        {bucket.id}
                      </div>
                      <div className="text-xs text-base-content/50">
                        {bucket.type} • {bucket.hostname}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
