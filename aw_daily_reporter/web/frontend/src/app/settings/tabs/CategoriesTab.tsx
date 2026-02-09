"use client"

import { ListFilter } from "lucide-react"
import dynamic from "next/dynamic"
import { Card } from "@/components/Card"
import { useTranslation } from "@/contexts/I18nContext"
import type { FullConfig, Rule } from "../types"

// Dynamic Components
const CategoryList = dynamic(
  () => import("@/app/settings/_components/CategoryList"),
  { ssr: false },
)

interface CategoriesTabProps {
  config: FullConfig | undefined
  localRules: Rule[]
  localCategoryList: string[]
  setLocalCategoryList: (list: string[]) => void
  handleSaveConfig: (
    newConfig: FullConfig | null,
    showNotification?: boolean,
    immediate?: boolean,
  ) => Promise<boolean>
}

export default function CategoriesTab({
  config,
  localRules,
  localCategoryList,
  setLocalCategoryList,
  handleSaveConfig,
}: CategoriesTabProps) {
  const { t } = useTranslation()

  if (!config?.settings) return null

  return (
    <div className="h-full overflow-y-auto pr-4 space-y-6">
      <Card title={t("Category List")}>
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-base-content/60">
              {t("Manage the list of known categories.")}
            </p>
            <button
              type="button"
              onClick={() => {
                const categoriesFromRules = Array.from(
                  new Set(localRules.map((r) => r.category).filter(Boolean)),
                )
                const newCategories = Array.from(
                  new Set([...localCategoryList, ...categoriesFromRules]),
                )
                setLocalCategoryList(newCategories)
                if (config) {
                  handleSaveConfig(
                    {
                      ...config,
                      settings: {
                        ...config.settings,
                        category_list: newCategories,
                      },
                    },
                    true,
                    true,
                  )
                }
              }}
              className="btn btn-xs btn-ghost gap-1 opacity-70 hover:opacity-100"
              title={t("Import categories used in existing rules")}
            >
              <ListFilter size={12} />
              {t("Import from Rules")}
            </button>
          </div>
          <CategoryList
            categories={localCategoryList}
            rules={localRules}
            onChange={async (newCategories, newColors, newBreaks) => {
              setLocalCategoryList(newCategories)
              if (config) {
                await handleSaveConfig(
                  {
                    ...config,
                    settings: {
                      ...config.settings,
                      category_list: newCategories,
                      category_colors: newColors,
                      break_categories: newBreaks,
                    },
                  },
                  true,
                )
              }
            }}
            initialColors={config?.settings?.category_colors}
            initialBreakCategories={config?.settings?.break_categories}
          />
        </div>
      </Card>
    </div>
  )
}
