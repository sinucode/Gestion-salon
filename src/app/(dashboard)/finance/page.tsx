import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign } from 'lucide-react'

export default function FinancePage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Finanzas (PyG)</h1>
                <p className="text-muted-foreground">Dashboard gerencial de ingresos, costos y utilidad</p>
            </div>
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5" />
                        Estado de Resultados
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground text-center py-12">
                        Conecta Supabase para ver el estado financiero.
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
