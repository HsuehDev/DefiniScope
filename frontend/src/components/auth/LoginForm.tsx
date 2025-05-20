import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface LoginFormProps {
  redirectPath?: string;
}

const LoginForm: React.FC<LoginFormProps> = ({ redirectPath = '/app' }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { login, error, clearError } = useAuth();
  const navigate = useNavigate();

  // 電子郵件驗證
  const validateEmail = (): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      setEmailError('請輸入電子郵件');
      return false;
    } else if (!emailRegex.test(email)) {
      setEmailError('請輸入有效的電子郵件格式');
      return false;
    }
    setEmailError(null);
    return true;
  };

  // 密碼驗證
  const validatePassword = (): boolean => {
    if (!password) {
      setPasswordError('請輸入密碼');
      return false;
    }
    setPasswordError(null);
    return true;
  };

  // 表單提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    
    // 驗證表單
    const isEmailValid = validateEmail();
    const isPasswordValid = validatePassword();
    
    if (!isEmailValid || !isPasswordValid) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await login({ email, password });
      navigate(redirectPath);
    } catch (error) {
      console.error('登入失敗:', error);
      // 錯誤已經在AuthContext中處理
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-8 bg-white shadow-tech-lg rounded-2xl w-full relative z-10 border border-tech-500/20">
      <div className="flex items-center justify-center mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-tech-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      </div>
      <h2 className="text-3xl font-bold text-center text-tech-800 mb-6">文獻智能助手</h2>
      
      {error && (
        <div className="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-md">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-tech-800 mb-2">電子郵件</label>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) validateEmail();
            }}
            onBlur={validateEmail}
            className={`w-full px-4 py-3 border ${
              emailError ? 'border-red-500' : 'border-tech-500/30'
            } rounded-xl shadow-sm focus:ring-tech-700 focus:border-tech-700 bg-tech-100/50 text-tech-800`}
            placeholder="請輸入您的電子郵件"
            data-testid="login-email"
          />
          {emailError && <p className="mt-1 text-xs text-red-500">{emailError}</p>}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-tech-800 mb-2">密碼</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) validatePassword();
              }}
              onBlur={validatePassword}
              className={`w-full px-4 py-3 border ${
                passwordError ? 'border-red-500' : 'border-tech-500/30'
              } rounded-xl shadow-sm focus:ring-tech-700 focus:border-tech-700 bg-tech-100/50 text-tech-800`}
              placeholder="請輸入您的密碼"
              data-testid="login-password"
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex items-center pr-4 text-tech-600 hover:text-tech-800"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? '隱藏' : '顯示'}
            </button>
          </div>
          {passwordError && <p className="mt-1 text-xs text-red-500">{passwordError}</p>}
        </div>
        
        <div>
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full flex justify-center py-3 px-6 border border-transparent rounded-xl shadow-tech text-sm font-medium text-white bg-tech-700 hover:bg-tech-700/80 transition-all duration-200 hover:shadow-tech-lg ${
              isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
            }`}
            data-testid="login-submit"
          >
            {isSubmitting ? '登入中...' : '登入系統'}
          </button>
        </div>
      </form>
      
      <p className="mt-6 text-center text-sm text-tech-700">
        還沒有帳號嗎？ <Link to="/register" className="font-medium text-tech-700 hover:text-tech-800">立即註冊</Link>
      </p>
    </div>
  );
};

export default LoginForm; 