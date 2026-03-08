import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MapPin, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function LocationsPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Sedes</h1>
                    <p className="text-muted-foreground">Gestiona las sedes de tu negocio</p>
                </div>
                <Button className="gradient-brand text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Nueva Sede
                </Button>
            </div>
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MapPin className="w-5 h-5" />
                        Lista de Sedes
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground text-center py-12">
                        Conecta Supabase para gestionar sedes.
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
