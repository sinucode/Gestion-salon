import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ToggleLeft } from 'lucide-react'

export default function FeatureFlagsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Feature Flags</h1>
                <p className="text-muted-foreground">Activa o desactiva módulos por negocio y sede</p>
            </div>
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ToggleLeft className="w-5 h-5" />
                        Módulos Disponibles
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground text-center py-12">
                        Conecta Supabase para gestionar feature flags.
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
