"use client"

import dynamic from "next/dynamic"

const Header = dynamic(() => import("./Header").then((mod) => mod.Header), {
  ssr: false,
})

export function NoSSRHeader() {
  return <Header />
}
