import { useState, useEffect, useRef } from 'react';
import { Moon, Sun, Upload as UploadIcon, Download, CreditCard, CheckCircle, AlertCircle, Menu, X } from 'lucide-react';

interface ParsedData {
  bank: string;
  card_last4: string | null;
  statement_date: string | null;
  payment_due_date: string | null;
  total_amount_due: string | null;
  [key: string]: string | number | null;
}

interface SnackbarMessage {
  id: number;
  message: string;
  type: 'success' | 'error';
}

const API_BASE_URL = 'http://127.0.0.1:5000';

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [activeSection, setActiveSection] = useState('home');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [snackbars, setSnackbars] = useState<SnackbarMessage[]>([]);
  const [scrollY, setScrollY] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  const homeRef = useRef<HTMLElement>(null);
  const uploadRef = useRef<HTMLElement>(null);
  const resultsRef = useRef<HTMLElement>(null);
  const aboutRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    checkBackendHealth();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);

      const sections = [
        { id: 'home', ref: homeRef },
        { id: 'upload', ref: uploadRef },
        { id: 'results', ref: resultsRef },
        { id: 'about', ref: aboutRef },
      ];

      for (const section of sections) {
        if (section.ref.current) {
          const rect = section.ref.current.getBoundingClientRect();
          if (rect.top <= 150 && rect.bottom >= 150) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const checkBackendHealth = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      if (response.ok) {
        setBackendStatus('online');
      } else {
        setBackendStatus('offline');
      }
    } catch (error) {
      setBackendStatus('offline');
      console.error('Backend health check failed:', error);
    }
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const scrollToSection = (sectionId: string) => {
    const refs: Record<string, React.RefObject<HTMLElement>> = {
      home: homeRef,
      upload: uploadRef,
      results: resultsRef,
      about: aboutRef,
    };

    refs[sectionId]?.current?.scrollIntoView({ behavior: 'smooth' });
    setIsMenuOpen(false);
  };

  const showSnackbar = (message: string, type: 'success' | 'error') => {
    const id = Date.now();
    setSnackbars(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setSnackbars(prev => prev.filter(snack => snack.id !== id));
    }, 4000);
  };

  const handleFileSelect = async (file: File) => {
    if (file.type !== 'application/pdf') {
      showSnackbar('Please upload a PDF file only', 'error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showSnackbar('File size must be less than 10MB', 'error');
      return;
    }

    if (backendStatus === 'offline') {
      showSnackbar('Backend server is offline. Please start the Flask server.', 'error');
      return;
    }

    setUploadedFile(file);
    setIsUploading(true);
    console.log('File uploaded:', {
      name: file.name,
      size: `${(file.size / 1024).toFixed(2)} KB`,
      type: file.type,
    });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE_URL}/parse`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to parse statement');
      }

      const data = await response.json();
      setParsedData(data);
      showSnackbar('Statement parsed successfully!', 'success');

      setTimeout(() => {
        scrollToSection('results');
      }, 500);
    } catch (error) {
      console.error('Error parsing statement:', error);
      showSnackbar(
        error instanceof Error ? error.message : 'Failed to parse statement',
        'error'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const downloadAnalysis = () => {
    if (!parsedData) {
      showSnackbar('No data to download', 'error');
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `statement_analysis_${timestamp}.json`;
    const blob = new Blob([JSON.stringify(parsedData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    showSnackbar('Analysis downloaded successfully!', 'success');
  };

  const formatFieldName = (key: string): string => {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatFieldValue = (key: string, value: string | number | null): string => {
    if (value === null) return 'N/A';

    if (key === 'card_last4' && value) {
      return `•••• ${value}`;
    }

    if (key === 'total_amount_due' && value) {
      const numValue = typeof value === 'string' ? parseFloat(value) : value;
      return `$${numValue.toFixed(2)}`;
    }

    return String(value);
  };

  const bgColor = theme === 'light' ? 'bg-neutral-50' : 'bg-neutral-900';
  const textColor = theme === 'light' ? 'text-neutral-900' : 'text-neutral-100';
  const primaryColor = theme === 'light' ? 'bg-purple-600' : 'bg-purple-500';
  const surfaceColor = theme === 'light' ? 'bg-white' : 'bg-neutral-800';
  const glassEffect = theme === 'light'
    ? 'bg-white/70 backdrop-blur-lg border border-white/20'
    : 'bg-neutral-800/70 backdrop-blur-lg border border-neutral-700/20';

  const parallaxOffset = scrollY * 0.5;

  return (
    <div className={`min-h-screen ${bgColor} ${textColor} font-sans transition-colors duration-300`}>
      <nav className={`fixed top-0 left-0 right-0 ${glassEffect} z-50 shadow-xl`}>
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard className={`w-8 h-8 ${theme === 'light' ? 'text-purple-600' : 'text-purple-400'}`} aria-label="Logo" />
              <span className="text-xl font-medium hidden sm:inline">Statement Parser</span>
            </div>

            <div className="hidden md:flex items-center gap-6">
              {[
                { id: 'home', label: 'Home' },
                { id: 'upload', label: 'Upload' },
                { id: 'results', label: 'Results' },
                { id: 'about', label: 'About' },
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={`px-4 py-2 rounded-full transition-all duration-300 font-medium ${
                    activeSection === item.id
                      ? `${primaryColor} text-white shadow-lg`
                      : `${surfaceColor} hover:shadow-md`
                  }`}
                  aria-label={item.label}
                >
                  {item.label}
                </button>
              ))}

              <div className="flex items-center gap-3 ml-4 pl-4 border-l border-neutral-300 dark:border-neutral-700">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      backendStatus === 'online'
                        ? 'bg-green-500'
                        : backendStatus === 'offline'
                        ? 'bg-red-500'
                        : 'bg-yellow-500'
                    }`}
                    title={`Backend: ${backendStatus}`}
                  ></div>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400 hidden lg:inline">
                    {backendStatus}
                  </span>
                </div>

                <button
                  onClick={toggleTheme}
                  className={`w-10 h-10 rounded-full ${surfaceColor} flex items-center justify-center hover:scale-105 transition-all duration-300 shadow-md`}
                  aria-label="Toggle theme"
                  title="Toggle theme"
                >
                  {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="md:hidden flex items-center gap-3">
              <div
                className={`w-2 h-2 rounded-full ${
                  backendStatus === 'online'
                    ? 'bg-green-500'
                    : backendStatus === 'offline'
                    ? 'bg-red-500'
                    : 'bg-yellow-500'
                }`}
                title={`Backend: ${backendStatus}`}
              ></div>

              <button
                onClick={toggleTheme}
                className={`w-10 h-10 rounded-full ${surfaceColor} flex items-center justify-center hover:scale-105 transition-all duration-300 shadow-md`}
                aria-label="Toggle theme"
              >
                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </button>

              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className={`w-10 h-10 rounded-full ${surfaceColor} flex items-center justify-center hover:scale-105 transition-all duration-300 shadow-md`}
                aria-label="Toggle menu"
              >
                {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {isMenuOpen && (
            <div className="md:hidden mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700 animate-fade-in-up">
              <div className="flex flex-col gap-2">
                {[
                  { id: 'home', label: 'Home' },
                  { id: 'upload', label: 'Upload' },
                  { id: 'results', label: 'Results' },
                  { id: 'about', label: 'About' },
                ].map(item => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className={`px-4 py-3 rounded-2xl transition-all duration-300 font-medium text-left ${
                      activeSection === item.id
                        ? `${primaryColor} text-white shadow-lg`
                        : `${surfaceColor} hover:shadow-md`
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </nav>

      <main className="pt-20">
        <section
          ref={homeRef}
          className="min-h-screen flex items-center justify-center relative overflow-hidden"
          style={{ transform: `translateY(${parallaxOffset}px)` }}
        >
          <div className="absolute inset-0 opacity-10">
            <div className={`absolute top-1/4 left-1/4 w-96 h-96 rounded-full ${theme === 'light' ? 'bg-purple-300' : 'bg-purple-600'} blur-3xl animate-pulse`}></div>
            <div className={`absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full ${theme === 'light' ? 'bg-blue-300' : 'bg-blue-600'} blur-3xl animate-pulse`} style={{ animationDelay: '1s' }}></div>
          </div>

          <div className="text-center z-10 px-8 max-w-4xl animate-fade-in">
            <h1 className="text-6xl font-medium mb-6 tracking-tight">
              Credit Card Statement Parser
            </h1>
            <p className={`text-xl mb-12 ${theme === 'light' ? 'text-neutral-600' : 'text-neutral-400'}`}>
              Upload your PDF statement and get instant analysis with downloadable results
            </p>
            <button
              onClick={() => scrollToSection('upload')}
              className={`${primaryColor} text-white px-8 py-4 rounded-full font-medium text-lg hover:shadow-2xl transition-all duration-300 hover:scale-105`}
            >
              Get Started
            </button>
          </div>
        </section>

        <section ref={uploadRef} className="min-h-screen flex items-center justify-center px-8 py-20">
          <div className={`max-w-2xl w-full ${glassEffect} rounded-3xl p-12 shadow-2xl animate-fade-in-up`}>
            <h2 className="text-4xl font-medium mb-4">Upload Statement</h2>
            <p className={`mb-8 ${theme === 'light' ? 'text-neutral-600' : 'text-neutral-400'}`}>
              Drag and drop your PDF statement or click to browse
            </p>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${
                isDragging
                  ? `border-purple-500 ${theme === 'light' ? 'bg-purple-50' : 'bg-purple-900/20'} scale-105`
                  : `${theme === 'light' ? 'border-neutral-300' : 'border-neutral-700'} hover:border-purple-400`
              }`}
            >
              <UploadIcon className={`w-16 h-16 mx-auto mb-4 ${theme === 'light' ? 'text-neutral-400' : 'text-neutral-600'} ${isUploading ? 'animate-pulse' : ''}`} />
              <p className="text-lg mb-4">
                {isUploading
                  ? 'Processing...'
                  : uploadedFile
                  ? uploadedFile.name
                  : 'Drop your PDF here'}
              </p>
              {uploadedFile && !isUploading && (
                <p className={`text-sm mb-4 ${theme === 'light' ? 'text-neutral-500' : 'text-neutral-500'}`}>
                  Size: {(uploadedFile.size / 1024).toFixed(2)} KB
                </p>
              )}
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileInput}
                className="hidden"
                id="file-upload"
                aria-label="Upload PDF file"
                disabled={isUploading}
              />
              <label
                htmlFor="file-upload"
                className={`${primaryColor} text-white px-6 py-3 rounded-full inline-block cursor-pointer hover:shadow-lg transition-all duration-300 hover:scale-105 ${
                  isUploading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isUploading ? 'Processing...' : 'Browse Files'}
              </label>
              <p className={`text-sm mt-4 ${theme === 'light' ? 'text-neutral-500' : 'text-neutral-500'}`}>
                Max file size: 10MB • PDF only
              </p>
            </div>
          </div>
        </section>

        <section ref={resultsRef} className="min-h-screen flex items-center justify-center px-8 py-20">
          <div className="max-w-4xl w-full">
            <h2 className="text-4xl font-medium mb-12 text-center">Analysis Results</h2>

            {parsedData ? (
              <div className="space-y-6 animate-fade-in-up">
                <div className={`${glassEffect} rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]`}>
                  <div className="grid md:grid-cols-2 gap-6">
                    {Object.entries(parsedData)
                      .filter(([key]) => key !== 'total_amount_due')
                      .map(([key, value]) => (
                        <div key={key}>
                          <p className={`text-sm mb-2 ${theme === 'light' ? 'text-neutral-500' : 'text-neutral-500'}`}>
                            {formatFieldName(key)}
                          </p>
                          <p className="text-lg font-medium">
                            {formatFieldValue(key, value)}
                          </p>
                        </div>
                      ))}
                  </div>

                  {parsedData.total_amount_due && (
                    <div className="mt-8 pt-8 border-t border-neutral-200 dark:border-neutral-700">
                      <p className={`text-sm mb-2 ${theme === 'light' ? 'text-neutral-500' : 'text-neutral-500'}`}>
                        Total Amount Due
                      </p>
                      <p className="text-4xl font-medium text-purple-600 dark:text-purple-400">
                        {formatFieldValue('total_amount_due', parsedData.total_amount_due)}
                      </p>
                    </div>
                  )}
                </div>

                <div className="text-center">
                  <button
                    onClick={downloadAnalysis}
                    className={`${primaryColor} text-white px-8 py-4 rounded-full font-medium inline-flex items-center gap-3 hover:shadow-2xl transition-all duration-300 hover:scale-105`}
                    aria-label="Download analysis"
                  >
                    <Download className="w-5 h-5" />
                    Download Analysis
                  </button>
                </div>
              </div>
            ) : (
              <div className={`${glassEffect} rounded-3xl p-12 text-center shadow-xl`}>
                <UploadIcon className={`w-16 h-16 mx-auto mb-4 ${theme === 'light' ? 'text-neutral-300' : 'text-neutral-700'}`} />
                <p className={theme === 'light' ? 'text-neutral-500' : 'text-neutral-500'}>
                  No data available. Upload a statement to see results.
                </p>
              </div>
            )}
          </div>
        </section>

        <section ref={aboutRef} className="min-h-screen flex items-center justify-center px-8 py-20">
          <div className={`max-w-3xl w-full ${glassEffect} rounded-3xl p-12 shadow-2xl animate-fade-in-up`}>
            <h2 className="text-4xl font-medium mb-6">About</h2>
            <div className={`space-y-4 ${theme === 'light' ? 'text-neutral-600' : 'text-neutral-400'} text-lg leading-relaxed`}>
              <p>
                The Credit Card Statement Parser is a modern web application designed to simplify the process of extracting key information from credit card statements.
              </p>
              <p>
                Built with Material Design 3 principles, this tool offers a seamless experience with dark/light mode support, intuitive navigation, and contemporary UI effects.
              </p>
              <p>
                Upload your PDF statement securely, view parsed data in an elegant format, and download the analysis as JSON for your records.
              </p>
              <p className="text-sm">
                Powered by Flask backend with OCR capabilities for accurate text extraction.
              </p>
            </div>
          </div>
        </section>

        <footer className={`${surfaceColor} py-8 text-center border-t ${theme === 'light' ? 'border-neutral-200' : 'border-neutral-800'}`}>
          <p className={theme === 'light' ? 'text-neutral-500' : 'text-neutral-500'}>
            Parser v1.0 • Material Design 3
          </p>
        </footer>
      </main>

      <div className="fixed bottom-8 right-8 flex flex-col gap-3 z-40">
        {snackbars.map(snack => (
          <div
            key={snack.id}
            className={`${glassEffect} px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-slide-in-right ${
              snack.type === 'success' ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'
            }`}
            role="alert"
          >
            {snack.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-500" />
            )}
            <span>{snack.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
