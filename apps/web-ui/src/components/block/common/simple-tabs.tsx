import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function SimpleTabs() {
  return (
    <div className="flex flex-col items-center gap-8">
      <Tabs defaultValue="profile" className="text-sm text-muted-foreground">
        <TabsList className="bg-sidebar">
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="7d">7D</TabsTrigger>
          <TabsTrigger value="14d">14D</TabsTrigger>
          <TabsTrigger value="30d">30D</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  )
}
