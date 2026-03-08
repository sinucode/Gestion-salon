import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function DamagesPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Novedades y Daños</h1>
                    <p className="text-muted-foreground">Reportes de insumos dañados y resoluciones</p>
                </div>
                <Button className="gradient-brand text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Reportar Novedad
                </Button>
            </div>
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        Reportes Pendientes
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground text-center py-12">
                        Conecta Supabase para gestionar novedades.
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
