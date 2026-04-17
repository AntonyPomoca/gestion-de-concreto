import React from 'react';
import { Button } from './ui/button';
import { LogIn } from 'lucide-react';
import { signInWithGoogle } from '../lib/firebase';
import { toast } from 'sonner';

export function LoginView() {
  const handleLogin = async () => {
    try {
      await signInWithGoogle();
      toast.success('Sesión iniciada con éxito');
    } catch (error) {
      console.error(error);
      toast.error('Error al iniciar sesión con Google');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 text-center">
        <div className="flex justify-center">
          <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl">
            <img src="/olla.png" alt="Olla" className="w-12 h-12 object-contain invert dark:invert-0" referrerPolicy="no-referrer" />
          </div>
        </div>
        <div>
          <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-50">Gestión de Concreto</h2>
          <p className="mt-2 text-slate-500 dark:text-slate-400">Inicia sesión para gestionar tus pedidos y unidades en tiempo real</p>
        </div>
        <div className="mt-8">
          <Button 
            onClick={handleLogin} 
            className="w-full h-12 text-lg font-medium rounded-xl flex items-center justify-center gap-3 bg-slate-900 hover:bg-slate-800 dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-200 transition-all active:scale-95"
          >
            <LogIn className="w-5 h-5" />
            Continuar con Google
          </Button>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Al continuar, aceptas los términos de uso y privacidad del sistema.
        </p>
      </div>
    </div>
  );
}
