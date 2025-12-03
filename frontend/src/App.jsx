import { useEffect, useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

async function apiRequest(path, options = {}) {
  const isFormData = options.body instanceof FormData;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: isFormData
      ? {
          ...(options.headers || {}),
        }
      : {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
    ...options,
  });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const message = data?.message || 'Something went wrong';
    throw new Error(message);
  }

  return data;
}

function getFileMeta(fileType, fileName) {
  const name = fileName || '';
  const lowerName = name.toLowerCase();
  const type = (fileType || '').toLowerCase();

  if (type.startsWith('image/')) {
    return { icon: '🖼️', label: 'Image' };
  }
  if (type === 'application/pdf' || lowerName.endsWith('.pdf')) {
    return { icon: '📕', label: 'PDF' };
  }
  if (
    type.includes('word') ||
    lowerName.endsWith('.doc') ||
    lowerName.endsWith('.docx')
  ) {
    return { icon: '📄', label: 'Document' };
  }
  if (
    type.includes('sheet') ||
    lowerName.endsWith('.xls') ||
    lowerName.endsWith('.xlsx')
  ) {
    return { icon: '📊', label: 'Spreadsheet' };
  }
  return { icon: '📎', label: 'File' };
}

const BACKGROUNDS = {
  midnight: {
    id: 'midnight',
    label: 'Midnight (default)',
    appClass: 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950',
    chatClass: 'bg-gradient-to-b from-slate-950/40 to-slate-950/80',
    type: 'color',
  },
  graphite: {
    id: 'graphite',
    label: 'Graphite',
    appClass: 'bg-slate-950',
    chatClass: 'bg-slate-900',
    type: 'color',
  },
  ocean: {
    id: 'ocean',
    label: 'Deep ocean',
    appClass: 'bg-gradient-to-br from-slate-950 via-sky-950 to-slate-950',
    chatClass: 'bg-gradient-to-b from-sky-950/40 to-slate-950/80',
    type: 'color',
  },
  customImage: {
    id: 'customImage',
    label: 'Custom image (URL)',
    appClass: 'bg-slate-950',
    chatClass: 'bg-slate-900/80',
    type: 'image',
  },
};

function App() {
  const [mode, setMode] = useState('signin'); // 'signin' | 'register'
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [currentChatters, setCurrentChatters] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadXhr, setUploadXhr] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState([]);
  const [bgId, setBgId] = useState('midnight');
  const [customBgUrl, setCustomBgUrl] = useState('');
  const [showBgPicker, setShowBgPicker] = useState(false);

  useEffect(() => {
    try {
      const storedId = localStorage.getItem('liveline-bg-id');
      const storedCustom = localStorage.getItem('liveline-bg-custom');
      if (storedId && BACKGROUNDS[storedId]) {
        setBgId(storedId);
      }
      if (storedCustom) {
        setCustomBgUrl(storedCustom);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('liveline-bg-id', bgId);
    } catch {
      // ignore
    }
  }, [bgId]);

  useEffect(() => {
    try {
      localStorage.setItem('liveline-bg-custom', customBgUrl || '');
    } catch {
      // ignore
    }
  }, [customBgUrl]);

  const currentBg = BACKGROUNDS[bgId] || BACKGROUNDS.midnight;
  const appBgStyle =
    currentBg.type === 'image' && customBgUrl
      ? {
          backgroundImage: `url(${customBgUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }
      : {};

  // Auth handlers
  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      fullname: formData.get('fullname'),
      username: formData.get('username'),
      email: formData.get('email'),
      gender: formData.get('gender'),
      password: formData.get('password'),
    };

    try {
      const data = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setUser(data);
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    const formData = new FormData(e.currentTarget);
    const payload = {
      email: formData.get('email'),
      password: formData.get('password'),
    };

    try {
      const data = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setUser(data);
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore errors on logout
    } finally {
      setUser(null);
      setSelectedUser(null);
      setMessages([]);
    }
  };

  // Chat + users
  useEffect(() => {
    if (!user) return;

    const fetchCurrentChatters = async () => {
      try {
        const data = await apiRequest('/api/user/currentchatters');
        setCurrentChatters(data || []);
      } catch (err) {
        console.error(err);
      }
    };

    fetchCurrentChatters();
  }, [user]);

  const handleSearch = async (value) => {
    setSearch(value);
    if (!value.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const params = new URLSearchParams({ search: value.trim() });
      const data = await apiRequest(`/api/user/search?${params.toString()}`);
      setSearchResults(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const selectChatUser = async (u) => {
    setSelectedUser(u);
    setChatError('');
    setSelectionMode(false);
    setSelectedMessageIds([]);
    setChatLoading(true);
    try {
      const data = await apiRequest(`/api/message/${u._id}`);
      setMessages(data || []);
      // Since opening a conversation marks messages as seen on the backend,
      // clear the unseen counter for this user in the currentChatters list.
      setCurrentChatters((prev) =>
        (prev || []).map((item) =>
          item?._id === u._id ? { ...item, unseenCount: 0 } : item
        )
      );
    } catch (err) {
      setChatError(err.message);
    } finally {
      setChatLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (!newMessage.trim() && !file) return;
    setChatError('');
    const text = newMessage.trim();
    setNewMessage('');
    const fileToSend = file;
    setFile(null);

    try {
      let data;
      if (fileToSend) {
        const formData = new FormData();
        if (text) formData.append('message', text);
        formData.append('file', fileToSend);

        setUploading(true);
        setUploadProgress(0);

        data = await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          setUploadXhr(xhr);
          xhr.open('POST', `${API_BASE_URL}/api/message/send/${selectedUser._id}`);
          xhr.withCredentials = true;

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percent = Math.round((event.loaded / event.total) * 100);
              setUploadProgress(percent);
            }
          };

          xhr.onload = () => {
            setUploading(false);
            setUploadXhr(null);
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const json = JSON.parse(xhr.responseText);
                resolve(json);
              } catch (err) {
                reject(new Error('Failed to parse server response'));
              }
            } else {
              let message = 'Upload failed';
              try {
                const json = JSON.parse(xhr.responseText);
                if (json?.message) message = json.message;
              } catch {
                // ignore
              }
              reject(new Error(message));
            }
          };

          xhr.onerror = () => {
            setUploading(false);
            setUploadXhr(null);
            reject(new Error('Network error while uploading file'));
          };

          xhr.send(formData);
        });
      } else {
        const body = JSON.stringify({ message: text });
        data = await apiRequest(`/api/message/send/${selectedUser._id}`, {
          method: 'POST',
          body,
        });
      }

      setMessages((prev) => [...prev, data]);
    } catch (err) {
      setChatError(err.message);
      // restore text / file if sending failed
      setNewMessage(text);
      setFile(fileToSend || null);
      setUploading(false);
      setUploadProgress(0);
      setUploadXhr(null);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (!selectedUser) return;
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      setFile(droppedFile);
    }
  };

  const toggleSelectionMode = () => {
    setSelectionMode((prev) => !prev);
    setSelectedMessageIds([]);
  };

  const toggleMessageSelection = (id) => {
    setSelectedMessageIds((prev) =>
      prev.includes(id) ? prev.filter((mId) => mId !== id) : [...prev, id]
    );
  };

  const handleDeleteSelected = async () => {
    if (!selectedUser || selectedMessageIds.length === 0) return;
    try {
      await apiRequest(`/api/message/bulk/${selectedUser._id}`, {
        method: 'DELETE',
        body: JSON.stringify({ messageIds: selectedMessageIds }),
      });
      setMessages((prev) => prev.filter((m) => !selectedMessageIds.includes(m._id)));
      setSelectedMessageIds([]);
      setSelectionMode(false);
    } catch (err) {
      setChatError(err.message);
    }
  };

  const handleDeleteConversation = async () => {
    if (!selectedUser) return;
    try {
      await apiRequest(`/api/message/clear/${selectedUser._id}`, {
        method: 'DELETE',
      });
      setMessages([]);
      setSelectionMode(false);
      setSelectedMessageIds([]);
      setCurrentChatters((prev) => prev.filter((u) => u._id !== selectedUser._id));
      setSelectedUser(null);
    } catch (err) {
      setChatError(err.message);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4">
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-[1.2fr,1fr] gap-10">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/80 border border-slate-700 px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-slate-300">Live, secure messaging</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-white">
              Welcome to <span className="text-indigo-400">Liveline</span>
            </h1>
            <p className="text-slate-300 max-w-lg">
              Chat in real time with the people who matter. Create an account in seconds or sign in with your
              email and password to continue your conversations.
            </p>
            <ul className="space-y-2 text-sm text-slate-300">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                Private, cookie-based sessions – your token stays in the browser.
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                Search people by name and start a conversation instantly.
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                Clean, responsive UI powered by React, Vite and Tailwind CSS.
              </li>
            </ul>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl shadow-black/60 p-6 backdrop-blur">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">
                {mode === 'signin' ? 'Sign in to Liveline' : 'Create your Liveline account'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setAuthError('');
                  setMode((m) => (m === 'signin' ? 'register' : 'signin'));
                }}
                className="text-xs text-slate-300 hover:text-indigo-300 underline-offset-4 hover:underline"
              >
                {mode === 'signin' ? "Need an account? Register" : 'Already have an account? Sign in'}
              </button>
            </div>

            {authError && (
              <div className="mb-4 rounded-md border border-red-500/60 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {authError}
              </div>
            )}

            {mode === 'signin' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-200">Email</label>
                  <input
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    placeholder="you@example.com"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-200">Password</label>
                  <input
                    name="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    placeholder="••••••••"
                  />
                </div>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-indigo-950/40 hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 disabled:cursor-not-allowed disabled:bg-indigo-800"
                >
                  {authLoading ? 'Signing you in…' : 'Sign in'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-200">Full name</label>
                    <input
                      name="fullname"
                      type="text"
                      required
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-200">Username</label>
                    <input
                      name="username"
                      type="text"
                      required
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      placeholder="johndoe"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-200">Email</label>
                  <input
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                    placeholder="you@example.com"
                  />
                </div>
                <div className="grid grid-cols-[1.2fr,0.8fr] gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-200">Password</label>
                    <input
                      name="password"
                      type="password"
                      required
                      autoComplete="new-password"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                      placeholder="Create a strong password"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-200">Gender</label>
                    <select
                      name="gender"
                      required
                      className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-50 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                      defaultValue="male"
                    >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm shadow-indigo-950/40 hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 disabled:cursor-not-allowed disabled:bg-indigo-800"
                >
                  {authLoading ? 'Creating your account…' : 'Create account'}
                </button>
              </form>
            )}

            <p className="mt-4 text-[11px] text-slate-400">
              By continuing you agree to Liveline’s terms. This demo uses secure HTTP-only cookies for auth, so
              make sure your backend is running at{' '}
              <span className="font-medium text-slate-200">
                {API_BASE_URL}
              </span>
              .
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen flex flex-col ${currentBg.appClass}`}
      style={appBgStyle}
    >
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 relative">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-indigo-500 text-xs font-semibold text-white shadow-lg shadow-indigo-900/60">
              LL
            </div>
            <div>
              <span className="block text-sm font-semibold text-white leading-none">Liveline</span>
              <span className="block text-[10px] text-slate-400 leading-none mt-0.5">
                Connected as {user?.username || user?.email}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowBgPicker((v) => !v)}
              className="text-xs rounded-full border border-slate-700/80 bg-slate-900/80 px-3 py-1.5 text-slate-200 hover:border-indigo-500 hover:text-indigo-200"
            >
              Background
            </button>
            <button
              onClick={handleLogout}
              className="text-xs rounded-full border border-slate-700/80 bg-slate-900/80 px-3 py-1.5 text-slate-200 hover:border-red-500/70 hover:text-red-200 hover:bg-red-950/40"
            >
              Log out
            </button>
          </div>
          {showBgPicker && (
            <div className="absolute right-4 top-14 z-20 w-64 rounded-xl border border-slate-700 bg-slate-950/95 p-3 shadow-xl shadow-black/60">
              <h3 className="mb-2 text-xs font-semibold text-slate-200">Chat background</h3>
              <div className="space-y-1">
                {Object.values(BACKGROUNDS).map((bg) => (
                  <button
                    key={bg.id}
                    type="button"
                    onClick={() => {
                      setBgId(bg.id);
                      setShowBgPicker(false);
                    }}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-[11px] ${
                      bgId === bg.id
                        ? 'bg-indigo-600/20 text-indigo-100 border border-indigo-500/50'
                        : 'bg-slate-900/60 text-slate-200 border border-transparent hover:border-slate-600'
                    }`}
                  >
                    <span
                      className={`h-5 w-5 rounded-md border border-slate-700 ${
                        bg.id === 'midnight'
                          ? 'bg-gradient-to-br from-slate-900 to-slate-800'
                        : bg.id === 'graphite'
                          ? 'bg-slate-900'
                        : bg.id === 'ocean'
                          ? 'bg-gradient-to-br from-sky-900 to-slate-900'
                          : 'bg-slate-800'
                      }`}
                    />
                    <span>{bg.label}</span>
                  </button>
                ))}
              </div>
              {bgId === 'customImage' && (
                <div className="mt-2 space-y-1">
                  <label className="text-[10px] text-slate-400">
                    Image URL
                  </label>
                  <input
                    type="url"
                    value={customBgUrl}
                    onChange={(e) => setCustomBgUrl(e.target.value)}
                    placeholder="https://example.com/background.jpg"
                    className="w-full rounded-md border border-slate-700 bg-slate-900/80 px-2 py-1 text-[11px] text-slate-50 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 gap-4 px-4 py-4">
        {/* Sidebar */}
        <aside className="flex w-72 flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-4 shadow-xl shadow-black/40">
          <div>
            <label className="text-xs font-medium text-slate-300 mb-1 block">Search people</label>
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search by name or username"
              className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>

          <div className="flex-1 space-y-3 overflow-hidden">
            <section className="space-y-1">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Current chats
                </h3>
              </div>
              <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
                {currentChatters.length === 0 && (
                  <p className="text-[11px] text-slate-500 italic">No conversations yet. Start a new chat.</p>
                )}
                {currentChatters.map((u) => (
                  <button
                    key={u._id}
                    type="button"
                    onClick={() => selectChatUser(u)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition ${
                      selectedUser?._id === u._id
                        ? 'bg-indigo-600/20 text-indigo-100 border border-indigo-500/50'
                        : 'border border-transparent hover:border-slate-700 hover:bg-slate-900/80 text-slate-200'
                    }`}
                  >
                    <img
                      src={u.profilepic}
                      alt={u.username}
                      className="h-7 w-7 rounded-full object-cover"
                    />
                    <div className="min-w-0 flex items-center justify-between gap-2">
      <div>
                        <p className="truncate font-medium">{u.username}</p>
                        <p className="truncate text-[10px] text-slate-400">{u.fullname}</p>
                      </div>
                      {u.unseenCount > 0 && (
                        <span className="ml-auto inline-flex min-w-[1.4rem] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                          {u.unseenCount}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="space-y-1">
              <div className="flex items-center justify-between">
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Search results
                </h3>
              </div>
              <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
                {search && searchResults.length === 0 && (
                  <p className="text-[11px] text-slate-500 italic">No users match that search.</p>
                )}
                {searchResults.map((u) => (
                  <button
                    key={u._id}
                    type="button"
                    onClick={() => selectChatUser(u)}
                    className="flex w-full items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left text-xs text-slate-200 hover:border-slate-700 hover:bg-slate-900/80"
                  >
                    <img
                      src={u.profilepic}
                      alt={u.username}
                      className="h-7 w-7 rounded-full object-cover"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{u.username}</p>
                      <p className="truncate text-[10px] text-slate-400">{u.email}</p>
      </div>
        </button>
                ))}
              </div>
            </section>
          </div>
        </aside>

        {/* Chat area */}
        <section className="flex flex-1 flex-col rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl shadow-black/40">
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            {selectedUser ? (
              <div className="flex items-center gap-3">
                <img
                  src={selectedUser.profilepic}
                  alt={selectedUser.username}
                  className="h-9 w-9 rounded-full object-cover"
                />
                <div>
                  <p className="text-sm font-semibold text-white">{selectedUser.username}</p>
                  <p className="text-[11px] text-slate-400">{selectedUser.fullname}</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">Select a person from the sidebar to start chatting.</p>
            )}

            <div className="flex items-center gap-2 text-[10px] text-slate-500">
              <span>
                Connected as <span className="font-semibold text-slate-300">{user.email}</span>
              </span>
              {selectedUser && (
                <>
                  <button
                    type="button"
                    onClick={toggleSelectionMode}
                    className={`rounded-full border px-2 py-0.5 text-[10px] ${
                      selectionMode
                        ? 'border-indigo-500 bg-indigo-600/20 text-indigo-200'
                        : 'border-slate-600 bg-slate-900/60 text-slate-200 hover:border-indigo-500 hover:text-indigo-200'
                    }`}
                  >
                    {selectionMode ? 'Cancel select' : 'Select messages'}
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteConversation}
                    className="rounded-full border border-red-500/70 bg-red-950/40 px-2 py-0.5 text-[10px] text-red-200 hover:bg-red-900/60"
                  >
                    Delete chat
                  </button>
                </>
              )}
            </div>
          </div>

          <div className={`flex-1 overflow-y-auto px-4 py-3 space-y-2 ${currentBg.chatClass}`}>
            {chatLoading && (
              <p className="text-xs text-slate-400 italic">Loading conversation…</p>
            )}
            {chatError && (
              <div className="rounded-md border border-red-500/60 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {chatError}
              </div>
            )}
            {!selectedUser && !chatLoading && (
              <div className="flex h-full items-center justify-center">
                <p className="text-xs text-slate-500">
                  Your conversations will appear here. Start by choosing someone to chat with.
        </p>
      </div>
            )}
            {selectedUser &&
              messages.map((m) => {
                const isMine = m.senderId === user._id;
                const isSelected = selectedMessageIds.includes(m._id);
                return (
                  <div
                    key={m._id}
                    className={`flex w-full items-center gap-2 ${
                      isMine ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {selectionMode && (
                      <button
                        type="button"
                        onClick={() => toggleMessageSelection(m._id)}
                        className={`h-4 w-4 rounded-sm border text-[10px] ${
                          isSelected
                            ? 'border-indigo-400 bg-indigo-500 text-white'
                            : 'border-slate-500 bg-slate-900 text-slate-300'
                        }`}
                      >
                        {isSelected ? '✓' : ''}
                      </button>
                    )}
                    <div
                      className={`max-w-xs rounded-2xl px-3 py-2 text-xs shadow-lg ${
                        isMine
                          ? 'bg-indigo-600 text-white rounded-br-sm'
                          : 'bg-slate-800 text-slate-50 rounded-bl-sm'
                      } ${selectionMode && isSelected ? 'ring-2 ring-indigo-300' : ''}`}
                    >
                      {m.message && (
                        <p className="whitespace-pre-wrap break-words mb-1">{m.message}</p>
                      )}
                      {m.fileUrl && (
                        <>
                          {m.fileType && m.fileType.startsWith('image/') ? (
                            <div className="mt-1 space-y-1">
                              <div className="inline-flex items-center gap-1 rounded-md bg-slate-900/60 px-2 py-0.5 text-[10px] text-slate-200">
                                <span>{getFileMeta(m.fileType, m.fileName).icon}</span>
                                <span>{getFileMeta(m.fileType, m.fileName).label}</span>
                              </div>
                              <img
                                src={`${API_BASE_URL}${m.fileUrl}`}
                                alt={m.fileName || 'image'}
                                className="max-h-64 rounded-lg border border-slate-700 object-contain"
                              />
                            </div>
                          ) : (
                            <a
                              href={`${API_BASE_URL}${m.fileUrl}`}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 inline-flex items-center gap-1 rounded-md bg-slate-900/60 px-2 py-1 text-[11px] underline underline-offset-4"
                            >
                              <span>{getFileMeta(m.fileType, m.fileName).icon}</span>
                              <span className="truncate max-w-[10rem]">
                                {m.fileName || 'Download file'}
                              </span>
                            </a>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>

          <form
            onSubmit={handleSendMessage}
            className="border-t border-slate-800 bg-slate-950/70 px-3 py-2"
          >
            <div
              className={`flex items-center gap-2 rounded-full px-2 py-1 transition-colors ${
                isDragging
                  ? 'border border-dashed border-indigo-500 bg-slate-900/80'
                  : 'border border-transparent'
              }`}
              onDragOver={handleDragOver}
              onDragEnter={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="flex items-center gap-1">
              <label className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-700 bg-slate-900/80 text-slate-300 hover:border-indigo-500 hover:text-indigo-300">
                <span className="text-lg leading-none">+</span>
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setFile(f);
                  }}
                />
              </label>
              {file && (
                <span className="max-w-[7rem] truncate text-[10px] text-slate-400">
                  {file.name}
                </span>
              )}
              </div>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={
                  selectedUser
                    ? isDragging
                      ? 'Drop file to attach…'
                      : 'Type a message or drop a file…'
                    : 'Select someone to start chatting'
                }
                disabled={!selectedUser}
                className="flex-1 rounded-full border border-slate-700 bg-slate-900/80 px-4 py-2 text-xs text-slate-50 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={!selectedUser || (!newMessage.trim() && !file)}
                className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-4 py-2 text-xs font-medium text-white shadow-md shadow-indigo-900/70 hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-800"
              >
                Send
              </button>
            </div>
          </form>
          {uploading && (
            <div className="border-t border-slate-800 bg-slate-950/80 px-4 py-1.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-400">Uploading file…</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-300">{uploadProgress}%</span>
                  {uploadXhr && (
                    <button
                      type="button"
                      onClick={() => {
                        uploadXhr.abort();
                        setUploading(false);
                        setUploadProgress(0);
                        setUploadXhr(null);
                        setFile(null);
                      }}
                      className="text-[10px] rounded-full border border-slate-600 px-2 py-0.5 text-slate-300 hover:border-red-500 hover:text-red-200"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-1.5 bg-indigo-500 transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
          {selectionMode && selectedMessageIds.length > 0 && (
            <div className="border-t border-slate-800 bg-slate-950/80 px-4 py-1.5 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">
                {selectedMessageIds.length} message(s) selected
              </span>
              <button
                type="button"
                onClick={handleDeleteSelected}
                className="rounded-full border border-red-500/70 bg-red-950/40 px-3 py-0.5 text-[10px] font-medium text-red-200 hover:bg-red-900/60"
              >
                Delete selected
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;

