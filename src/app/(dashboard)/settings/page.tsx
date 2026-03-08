import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Settings } from 'lucide-react'

export default function SettingsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
                <p className="text-muted-foreground">Perfil y preferencias del usuario</p>
            </div>
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Settings className="w-5 h-5" />
                        Mi Perfil
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground text-center py-12">
                        Conecta Supabase para editar tu perfil.
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
