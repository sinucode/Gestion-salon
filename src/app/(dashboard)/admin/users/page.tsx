import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function UsersPage() {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Usuarios</h1>
                    <p className="text-muted-foreground">Administra profesionales, clientes y administradores</p>
                </div>
                <Button className="gradient-brand text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Nuevo Usuario
                </Button>
            </div>
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        Lista de Usuarios
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground text-center py-12">
                        Conecta Supabase para gestionar usuarios.
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
