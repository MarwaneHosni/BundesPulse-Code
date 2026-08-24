import { Link } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface ViewScaffoldProps {
  title: string
  specRef: string
  description: string
  children?: React.ReactNode
}

export function ViewScaffold({ title, specRef, description, children }: ViewScaffoldProps) {
  return (
    <div className="container py-8">
      <div className="mb-8 max-w-3xl">
        <p className="text-sm font-medium text-muted-foreground">
          FOUNDATION · {specRef}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-muted-foreground">{description}</p>
      </div>
      {children}
      <div className="mt-10">
        <Card>
          <CardHeader>
            <CardTitle>Nächster Schritt</CardTitle>
            <CardDescription>
              Diese Ansicht wird in einer späteren Phase implementiert. Die
              vollständige Produktvorgabe steht in{" "}
              <Link
                to="/methodology"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                docs/product-spec.md
              </Link>
              .
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Grundlage: {description}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}