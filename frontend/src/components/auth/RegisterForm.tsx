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
    <div className="p-8 bg-white shadow-tech-lg rounded-2xl w-full relative z-10 border border-tech-500/20">
      <div className="flex items-center justify-center mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-tech-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      </div>
      <h2 className="text-3xl font-bold text-center text-tech-800 mb-6">註冊新帳號</h2>
      
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
            data-testid="register-email"
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
                if (confirmPassword && confirmPasswordError) validateConfirmPassword();
              }}
              onBlur={validatePassword}
              className={`w-full px-4 py-3 border ${
                passwordError ? 'border-red-500' : 'border-tech-500/30'
              } rounded-xl shadow-sm focus:ring-tech-700 focus:border-tech-700 bg-tech-100/50 text-tech-800`}
              placeholder="請設定您的密碼"
              data-testid="register-password"
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
          
          {/* 密碼強度指示器 */}
          <p className="mt-1 text-xs text-tech-700">密碼需至少 8 個字元，包含大小寫字母和數字</p>
          {password && (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-tech-700">密碼強度:</span>
                <span className="text-xs font-medium text-tech-700">{getStrengthText()}</span>
              </div>
              <div className="w-full h-1.5 bg-gray-200 rounded-full">
                <div
                  className={`h-1.5 rounded-full ${getStrengthColor()}`}
                  style={{ width: `${(passwordStrength / 5) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-tech-800 mb-2">確認密碼</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (confirmPasswordError) validateConfirmPassword();
              }}
              onBlur={validateConfirmPassword}
              className={`w-full px-4 py-3 border ${
                confirmPasswordError ? 'border-red-500' : 'border-tech-500/30'
              } rounded-xl shadow-sm focus:ring-tech-700 focus:border-tech-700 bg-tech-100/50 text-tech-800`}
              placeholder="請再次輸入密碼"
              data-testid="register-confirm-password"
            />
          </div>
          {confirmPasswordError && <p className="mt-1 text-xs text-red-500">{confirmPasswordError}</p>}
        </div>
        
        <div>
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full flex justify-center py-3 px-6 border border-transparent rounded-xl shadow-tech text-sm font-medium text-white bg-tech-700 hover:bg-tech-700/80 transition-all duration-200 hover:shadow-tech-lg ${
              isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
            }`}
            data-testid="register-submit"
          >
            {isSubmitting ? '註冊中...' : '立即註冊'}
          </button>
        </div>
      </form>
      
      <p className="mt-6 text-center text-sm text-tech-700">
        已經有帳號了嗎？ <Link to="/login" className="font-medium text-tech-700 hover:text-tech-800">立即登入</Link>
      </p>
    </div>
  );
};

export default RegisterForm; 