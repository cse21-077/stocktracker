import { Suspense } from "react"
import Sidebar from "../components/Sidebar"
import MainContent from "../components/MainContent"
import { Card } from "@/components/ui/card"


export default function Home() {
  return (
    <div className="min-h-screen flex bg-background black">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="container py-6">
          <Card className="p-6">
            <Suspense fallback={<div className="text-center">Loading...</div>}>
              <MainContent />
            </Suspense>
          </Card>
        </div>
      </main>
    </div>
  )
}

