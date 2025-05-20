import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface RegisterFormProps {
  redirectPath?: string;
}

const RegisterForm: React.FC<RegisterFormProps> = ({ redirectPath = '/app' }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const [passwordStrength, setPasswordStrength] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { register, error, clearError } = useAuth();
  const navigate = useNavigate();

  // 評估密碼強度
  useEffect(() => {
    if (!password) {
      setPasswordStrength(0);
      return;
    }
    
    let strength = 0;
    
    // 長度檢查
    if (password.length >= 8) strength += 1;
    
    // 包含小寫字母
    if (/[a-z]/.test(password)) strength += 1;
    
    // 包含大寫字母
    if (/[A-Z]/.test(password)) strength += 1;
    
    // 包含數字
    if (/[0-9]/.test(password)) strength += 1;
    
    // 包含特殊字符
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    
    setPasswordStrength(strength);
  }, [password]);

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
    } else if (password.length < 8) {
      setPasswordError('密碼長度至少8個字元');
      return false;
    } else if (!/[A-Z]/.test(password)) {
      setPasswordError('密碼必須包含至少一個大寫字母');
      return false;
    } else if (!/[0-9]/.test(password)) {
      setPasswordError('密碼必須包含至少一個數字');
      return false;
    }
    setPasswordError(null);
    return true;
  };

  // 確認密碼驗證
  const validateConfirmPassword = (): boolean => {
    if (!confirmPassword) {
      setConfirmPasswordError('請再次輸入密碼');
      return false;
    } else if (confirmPassword !== password) {
      setConfirmPasswordError('兩次輸入的密碼不一致');
      return false;
    }
    setConfirmPasswordError(null);
    return true;
  };

  // 表單提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    
    // 驗證表單
    const isEmailValid = validateEmail();
    const isPasswordValid = validatePassword();
    const isConfirmPasswordValid = validateConfirmPassword();
    
    if (!isEmailValid || !isPasswordValid || !isConfirmPasswordValid) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await register({ email, password });
      navigate(redirectPath);
    } catch (error) {
      console.error('註冊失敗:', error);
      // 錯誤已經在AuthContext中處理
    } finally {
      setIsSubmitting(false);
    }
  };

  // 密碼強度顏色
  const getStrengthColor = (): string => {
    if (passwordStrength <= 2) return 'bg-red-500';
    if (passwordStrength <= 3) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  // 密碼強度文字
  const getStrengthText = (): string => {
    if (!password) return '';
    if (passwordStrength <= 2) return '弱';
    if (passwordStrength <= 3) return '中';
    return '強';
  };

  return (
    <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold text-center text-gray-800">註冊帳號</h1>
      
      {error && (
        <div className="p-3 text-sm text-red-700 bg-red-100 rounded-md">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            電子郵件
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailError) validateEmail();
            }}
            onBlur={validateEmail}
            className={`mt-1 block w-full px-3 py-2 border ${
              emailError ? 'border-red-500' : 'border-gray-300'
            } rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500`}
            placeholder="your@email.com"
            data-testid="register-email"
          />
          {emailError && <p className="mt-1 text-xs text-red-500">{emailError}</p>}
        </div>
        
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            密碼
          </label>
          <div className="relative mt-1">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) validatePassword();
                if (confirmPassword && confirmPasswordError) validateConfirmPassword();
              }}
              onBlur={validatePassword}
              className={`block w-full px-3 py-2 border ${
                passwordError ? 'border-red-500' : 'border-gray-300'
              } rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500`}
              placeholder="••••••••"
              data-testid="register-password"
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-500"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? '隱藏' : '顯示'}
            </button>
          </div>
          {passwordError && <p className="mt-1 text-xs text-red-500">{passwordError}</p>}
          
          {/* 密碼強度指示器 */}
          {password && (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">密碼強度:</span>
                <span className="text-xs font-medium">{getStrengthText()}</span>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded-full">
                <div
                  className={`h-2 rounded-full ${getStrengthColor()}`}
                  style={{ width: `${(passwordStrength / 5) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
        
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
            確認密碼
          </label>
          <div className="relative mt-1">
            <input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (confirmPasswordError) validateConfirmPassword();
              }}
              onBlur={validateConfirmPassword}
              className={`block w-full px-3 py-2 border ${
                confirmPasswordError ? 'border-red-500' : 'border-gray-300'
              } rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500`}
              placeholder="••••••••"
              data-testid="register-confirm-password"
            />
          </div>
          {confirmPasswordError && <p className="mt-1 text-xs text-red-500">{confirmPasswordError}</p>}
        </div>
        
        <div>
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
              isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
            }`}
            data-testid="register-submit"
          >
            {isSubmitting ? '註冊中...' : '註冊'}
          </button>
        </div>
      </form>
      
      <div className="text-sm text-center">
        <span className="text-gray-600">已有帳號？</span>{' '}
        <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
          立即登入
        </Link>
      </div>
    </div>
  );
};

export default RegisterForm; 