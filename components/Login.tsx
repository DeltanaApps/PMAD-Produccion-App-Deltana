
import React, { useMemo, useState } from 'react';
import { EyeIcon, EyeOffIcon } from './ui/Icons';

interface LoginProps {
  onLogin: (email: string, password: string) => Promise<string | null>;
  onLoginWithMicrosoft: () => Promise<string | null>;
}

const MicrosoftIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="1" width="9" height="9" fill="#f25022" />
    <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
    <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
  </svg>
);

const montserrat: React.CSSProperties = { fontFamily: '"Montserrat", sans-serif' };

const HERO_IMAGES = ['/images/login/hero-1.jpg', '/images/login/hero-2.jpg', '/images/login/hero-3.jpg', '/images/login/hero-4.jpg'];

const Login: React.FC<LoginProps> = ({ onLogin, onLoginWithMicrosoft }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [msSubmitting, setMsSubmitting] = useState(false);

  // Pick once per mount so it doesn't shuffle on every re-render/keystroke.
  const heroImage = useMemo(() => HERO_IMAGES[Math.floor(Math.random() * HERO_IMAGES.length)], []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const errorMessage = await onLogin(email, password);
    setSubmitting(false);
    if (errorMessage) {
      setError(errorMessage);
      setPassword('');
    }
  };

  const handleMicrosoftClick = async () => {
    setMsSubmitting(true);
    setError(null);
    const errorMessage = await onLoginWithMicrosoft();
    if (errorMessage) {
      setError(errorMessage);
      setMsSubmitting(false);
    }
    // on success the browser navigates away to Microsoft's login page
  };

  return (
    <div id="login-screen-root" className="min-h-screen flex">
      {/* Login is a fixed brand experience, independent of the in-app
          light/dark theme preference — theme-light.css's global
          [data-theme="light"] overrides would otherwise repaint this
          screen's white text as near-black and make it unreadable. */}
      <style>{`
        #login-screen-root .text-white { color: #ffffff !important; }
        #login-screen-root .text-gray-200 { color: #e5e7eb !important; }
      `}</style>
      {/* Branding panel — construction imagery, Deltana-style hero */}
      <div
        className="hidden md:flex md:w-1/2 relative flex-col justify-end p-12 text-white"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(15,23,42,0.55) 0%, rgba(15,23,42,0.6) 45%, rgba(15,23,42,0.92) 100%), url('${heroImage}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="mb-8 bg-white/95 rounded-lg px-4 py-3 inline-block w-fit shadow-lg">
          <img src="/images/logo-deltana.png" alt="Deltana Engineering" className="h-9" />
        </div>
        <h2 className="text-3xl font-extrabold leading-tight max-w-md" style={{ ...montserrat, textShadow: '0 2px 16px rgba(0,0,0,0.85)' }}>
          Enfoque global y una metodología única para cada proyecto.
        </h2>
        <p className="text-gray-200 mt-4 max-w-sm text-sm" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.85)' }}>
          Gestión de proyectos, equipos y rentabilidad para nuestro estudio de ingeniería y arquitectura.
        </p>
      </div>

      {/* Login form panel */}
      <div className="w-full md:w-1/2 flex items-center justify-center bg-white p-4">
        <div className="w-full max-w-sm">
          <div className="mb-10 md:hidden text-center">
            <img src="/images/logo-deltana.png" alt="Deltana Engineering" className="h-10 mx-auto mb-2" />
          </div>

          <div className="hidden md:block mb-8">
            <img src="/images/logo-deltana.png" alt="Deltana Engineering" className="h-8 mb-6" />
          </div>

          <h1 className="text-2xl font-extrabold text-gray-900 mb-1" style={montserrat}>
            Acceso al sistema
          </h1>
          <p className="text-gray-500 text-sm mb-8">Ingresá con tu cuenta para continuar.</p>

          <button
            type="button"
            onClick={handleMicrosoftClick}
            disabled={msSubmitting}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-3 rounded-lg transition-all disabled:opacity-60"
          >
            <MicrosoftIcon className="w-5 h-5" />
            {msSubmitting ? 'Redirigiendo...' : 'Iniciar sesión con Microsoft'}
          </button>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">o continuá con tu email</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError(null);
                }}
                className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-[#FBA628] focus:border-[#FBA628] outline-none transition-all"
                placeholder="tu@deltana.es"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Contraseña</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  className="w-full bg-white border border-gray-300 rounded-lg pl-4 pr-11 py-2.5 text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-[#FBA628] focus:border-[#FBA628] outline-none transition-all"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors"
                  title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-red-600 text-sm text-center bg-red-50 py-2 rounded-lg border border-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#FBA628] hover:bg-[#e9971f] text-white font-bold py-3 rounded-lg transition-all shadow-lg shadow-orange-500/20 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:hover:scale-100"
              style={montserrat}
            >
              {submitting ? 'ENTRANDO...' : 'ENTRAR'}
            </button>
          </form>

          <p className="text-center text-gray-400 text-xs mt-10">
            &copy; {new Date().getFullYear()} Deltana Engineering. Acceso restringido al personal autorizado.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
