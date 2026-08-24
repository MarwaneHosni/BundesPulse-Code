import { Link } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function NotFoundPage() {
  return (
    <div className="container py-16">
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>Seite nicht gefunden</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Diese Route existiert nicht.{" "}
            <Link to="/" className="font-medium text-primary hover:underline">
              Zurück zu Explore
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  )
}