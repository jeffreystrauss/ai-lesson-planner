import React, { useState, useEffect } from 'react';
import { BookOpen, Settings, Save, Share2, Download, RefreshCw, LogIn, LogOut, Users, Lightbulb, AlertCircle, Printer } from 'lucide-react';

const API_BASE = '/api'; // Cloudflare Workers endpoint

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [view, setView] = useState('home');
  const [isPrintView, setIsPrintView] = useState(false);
  
  // Settings
  const [apiKey, setApiKey] = useState('');
  const [gptLink, setGptLink] = useState('');
  
  // Lesson planning state
  const [subject, setSubject] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [learningObjective, setLearningObjective] = useState('');
  const [lessonPlan, setLessonPlan] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Saved plans
  const [savedPlans, setSavedPlans] = useState([]);
  const [communityPlans, setCommunityPlans] = useState([]);

  useEffect(() => {
    checkAuth();
    loadCommunityPlans();
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadSettings();
      loadSavedPlans();
    }
  }, [currentUser]);

  const loadSettings = async () => {
    if (!currentUser) return;
    try {
      const response = await fetch(`${API_BASE}/settings`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setApiKey(data.apiKey || '');
        setGptLink(data.gptLink || '');
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const saveSettings = async () => {
    if (!currentUser) {
      alert('Please log in to save settings!');
      setShowAuth(true);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ apiKey, gptLink })
      });
      
      if (response.ok) {
        setShowSettings(false);
        alert('Settings saved successfully!');
      } else {
        const error = await response.text();
        console.error('Settings save failed:', error);
        alert('Failed to save settings. Please try logging in again.');
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings: ' + error.message);
    }
  };

  const checkAuth = async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/me`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        if (data.user) {
          setCurrentUser(data.user);
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    }
  };

  const loginWithGoogle = () => {
    window.location.href = `${API_BASE}/auth/google`;
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      setCurrentUser(null);
      setSavedPlans([]);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const loadSavedPlans = async () => {
    try {
      const response = await fetch(`${API_BASE}/plans`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setSavedPlans(data.plans || []);
      }
    } catch (error) {
      console.error('Failed to load plans:', error);
    }
  };

  const loadCommunityPlans = async () => {
    try {
      const response = await fetch(`${API_BASE}/community-plans`);
      if (response.ok) {
        const data = await response.json();
        setCommunityPlans(data.plans || []);
      }
    } catch (error) {
      console.error('Failed to load community plans:', error);
    }
  };

  const generateLessonPlan = async () => {
    if (!currentUser) {
      alert('Please log in first to generate lesson plans!');
      setShowAuth(true);
      return;
    }

    if (!apiKey && !gptLink) {
      alert('Please configure your ChatGPT API key or GPT link in Settings first!');
      setShowSettings(true);
      return;
    }

    if (!subject || !gradeLevel || !learningObjective) {
      alert('Please fill in all fields!');
      return;
    }

    setIsGenerating(true);

    try {
      const response = await fetch(`${API_BASE}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          subject,
          gradeLevel,
          learningObjective,
          useApiKey: !!apiKey,
          useGptLink: !!gptLink
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to generate lesson plan');
      }

      const data = await response.json();
      setLessonPlan(data.lessonPlan);
    } catch (error) {
      console.error('Generation failed:', error);
      alert('Failed to generate lesson plan: ' + error.message + '\n\nPlease check that:\n1. You are logged in\n2. Your API key is valid\n3. You have OpenAI API credits');
    } finally {
      setIsGenerating(false);
    }
  };

  const saveLessonPlan = async () => {
    if (!currentUser) {
      alert('Please log in to save lesson plans!');
      setShowAuth(true);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(lessonPlan)
      });

      if (response.ok) {
        alert('Lesson plan saved!');
        loadSavedPlans();
      }
    } catch (error) {
      console.error('Failed to save plan:', error);
      alert('Failed to save lesson plan');
    }
  };

  const shareToComm = async () => {
    if (!currentUser) {
      alert('Please log in to share to community!');
      setShowAuth(true);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/community-plans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(lessonPlan)
      });

      if (response.ok) {
        alert('Shared to community!');
        loadCommunityPlans();
      }
    } catch (error) {
      console.error('Failed to share plan:', error);
      alert('Failed to share to community');
    }
  };

  const handlePrint = () => {
    setIsPrintView(true);
    setTimeout(() => {
      window.print();
      setIsPrintView(false);
    }, 100);
  };

  const examplePlans = [
    {
      title: "High School Biology: Cell Division",
      subject: "Biology",
      grade: "High School (9-12)",
      objective: "Students will understand mitosis and meiosis processes",
      approach: "AI generates custom diagrams and quizzes for differentiated learning"
    },
    {
      title: "Middle School Math: Algebraic Expressions",
      subject: "Mathematics",
      grade: "Middle School (6-8)",
      objective: "Students will simplify and evaluate algebraic expressions",
      approach: "AI provides unlimited practice problems with step-by-step explanations"
    },
    {
      title: "University History: Primary Source Analysis",
      subject: "History",
      grade: "University",
      objective: "Students will analyze historical documents critically",
      approach: "AI helps locate sources; students evaluate bias and context independently"
    }
  ];

  return (
    <div className={`min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 ${isPrintView ? 'print-view' : ''}`}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-view { background: white !important; }
          .print-view main { max-width: 100% !important; padding: 20px !important; }
          .print-view .bg-gradient-to-br { background: white !important; }
          .shadow-lg, .shadow-md { box-shadow: none !important; }
        }
      `}</style>

      {/* Header */}
      <header className="bg-white shadow-md no-print">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="text-indigo-600" size={32} />
            <h1 className="text-2xl font-bold text-gray-800">AI Lesson Planner</h1>
          </div>
          
          <nav className="flex items-center gap-4">
            <button onClick={() => setView('home')} className="text-gray-600 hover:text-indigo-600 transition">
              Home
            </button>
            <button onClick={() => setView('planner')} className="text-gray-600 hover:text-indigo-600 transition">
              Create Plan
            </button>
            <button onClick={() => setView('examples')} className="text-gray-600 hover:text-indigo-600 transition">
              Examples
            </button>
            <button onClick={() => setView('community')} className="text-gray-600 hover:text-indigo-600 transition">
              <Users size={20} className="inline mr-1" />
              Community
            </button>
            <button onClick={() => setShowSettings(true)} className="text-gray-600 hover:text-indigo-600 transition">
              <Settings size={20} />
            </button>
            {currentUser ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">{currentUser.email}</span>
                <button onClick={handleLogout} className="text-gray-600 hover:text-red-600 transition">
                  <LogOut size={20} />
                </button>
              </div>
            ) : (
              <button onClick={loginWithGoogle} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition">
                <LogIn size={20} className="inline mr-1" />
                Sign in with Google
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Main Content Area */}
          <div className="flex-1">
            {view === 'home' && (
              <div className="bg-white rounded-lg shadow-lg p-8">
                <h2 className="text-3xl font-bold text-gray-800 mb-4">
                  Integrate AI Ethically & Effectively
                </h2>
                <p className="text-lg text-gray-600 mb-6">
                  Learn to design lesson plans that harness AI's power while maintaining academic integrity and developing critical thinking skills.
                </p>
                
                <div className="grid md:grid-cols-3 gap-6 mb-8">
                  <div className="bg-indigo-50 p-6 rounded-lg">
                    <Lightbulb className="text-indigo-600 mb-3" size={32} />
                    <h3 className="font-bold text-gray-800 mb-2">Pedagogically Sound</h3>
                    <p className="text-gray-600 text-sm">Based on Bloom's Taxonomy, Kirkpatrick's Model, and proven teaching frameworks</p>
                  </div>
                  <div className="bg-green-50 p-6 rounded-lg">
                    <AlertCircle className="text-green-600 mb-3" size={32} />
                    <h3 className="font-bold text-gray-800 mb-2">Ethically Designed</h3>
                    <p className="text-gray-600 text-sm">Emphasizes transparency, verification, and original student thinking</p>
                  </div>
                  <div className="bg-purple-50 p-6 rounded-lg">
                    <Users className="text-purple-600 mb-3" size={32} />
                    <h3 className="font-bold text-gray-800 mb-2">Community Driven</h3>
                    <p className="text-gray-600 text-sm">Share and learn from successful lesson plans across subjects and grades</p>
                  </div>
                </div>

                <button 
                  onClick={() => setView('planner')}
                  className="bg-indigo-600 text-white px-8 py-3 rounded-lg hover:bg-indigo-700 transition text-lg font-semibold"
                >
                  Create Your First Lesson Plan
                </button>
              </div>
            )}

            {view === 'planner' && (
              <div className="bg-white rounded-lg shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Create AI-Enhanced Lesson Plan</h2>
                
                {!lessonPlan ? (
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Subject Matter
                      </label>
                      <input
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="e.g., Biology, Mathematics, History"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Grade/Level of Instruction
                      </label>
                      <input
                        type="text"
                        value={gradeLevel}
                        onChange={(e) => setGradeLevel(e.target.value)}
                        placeholder="e.g., 9th Grade, Middle School, University"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Learning Objective
                      </label>
                      <textarea
                        value={learningObjective}
                        onChange={(e) => setLearningObjective(e.target.value)}
                        placeholder="What should students be able to do by the end of this lesson?"
                        rows={4}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                      <p className="text-sm text-gray-500 mt-2">
                        Need help defining your learning objective? Try{' '}
                        <a 
                          href="https://logen.viablelab.org/login/" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:underline font-semibold"
                        >
                          LOGEN AI
                        </a>
                      </p>
                    </div>

                    <button
                      onClick={generateLessonPlan}
                      disabled={isGenerating}
                      className="w-full bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {isGenerating ? 'Generating...' : 'Generate Lesson Plan'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Action Buttons */}
                    <div className="flex gap-3 flex-wrap no-print">
                      <button onClick={saveLessonPlan} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition">
                        <Save size={18} />
                        Save Plan
                      </button>
                      <button onClick={shareToComm} className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition">
                        <Share2 size={18} />
                        Share to Community
                      </button>
                      <button onClick={handlePrint} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
                        <Printer size={18} />
                        Print
                      </button>
                      <button 
                        onClick={() => setLessonPlan(null)} 
                        className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition"
                      >
                        <RefreshCw size={18} />
                        Create New
                      </button>
                    </div>

                    {/* Lesson Plan Display */}
                    <div className="border-t pt-6">
                      <h3 className="text-xl font-bold text-gray-800 mb-4">{lessonPlan.title}</h3>
                      
                      <div className="bg-gray-50 p-4 rounded-lg mb-6">
                        <p><strong>Subject:</strong> {lessonPlan.subject}</p>
                        <p><strong>Grade Level:</strong> {lessonPlan.gradeLevel}</p>
                        <p><strong>Learning Objective:</strong> {lessonPlan.learningObjective}</p>
                      </div>

                      <div className="mb-6">
                        <h4 className="text-lg font-bold text-indigo-600 mb-3">AI Integration Approach</h4>
                        <p className="font-semibold mb-2">{lessonPlan.aiIntegration.approach}</p>
                        <p className="text-gray-700 mb-4">{lessonPlan.aiIntegration.description}</p>
                        
                        <h5 className="font-bold text-gray-800 mb-2">Why This Approach?</h5>
                        <ul className="list-disc pl-6 space-y-2 text-gray-700">
                          {lessonPlan.aiIntegration.rationale.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="mb-6">
                        <h4 className="text-lg font-bold text-indigo-600 mb-3">Ethical Considerations</h4>
                        <ul className="list-disc pl-6 space-y-2 text-gray-700">
                          {lessonPlan.aiIntegration.ethicalConsiderations.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="mb-6">
                        <h4 className="text-lg font-bold text-indigo-600 mb-3">Lesson Activities</h4>
                        {lessonPlan.activities.map((activity, idx) => (
                          <div key={idx} className="bg-blue-50 p-4 rounded-lg mb-3">
                            <h5 className="font-bold text-gray-800 mb-2">{activity.phase}</h5>
                            <p className="text-gray-700 mb-2"><strong>Activity:</strong> {activity.activity}</p>
                            <p className="text-gray-600 text-sm"><strong>Student Role:</strong> {activity.studentRole}</p>
                            <p className="text-gray-600 text-sm"><strong>Teacher Role:</strong> {activity.teacherRole}</p>
                          </div>
                        ))}
                      </div>

                      <div className="mb-6">
                        <h4 className="text-lg font-bold text-indigo-600 mb-3">Assessment Strategy</h4>
                        <p className="text-gray-700">{lessonPlan.assessmentStrategy}</p>
                      </div>

                      <div className="mb-6">
                        <h4 className="text-lg font-bold text-indigo-600 mb-3">Pedagogical Frameworks Applied</h4>
                        <ul className="list-disc pl-6 space-y-2 text-gray-700">
                          {lessonPlan.pedagogicalFrameworks.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="mb-6">
                        <h4 className="text-lg font-bold text-indigo-600 mb-3">Suggested AI Tools</h4>
                        <ul className="list-disc pl-6 space-y-2 text-gray-700">
                          {lessonPlan.toolSuggestions.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {view === 'examples' && (
              <div className="bg-white rounded-lg shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Example Lesson Plans</h2>
                <div className="space-y-4">
                  {examplePlans.map((plan, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition">
                      <h3 className="text-xl font-bold text-gray-800 mb-2">{plan.title}</h3>
                      <p className="text-sm text-gray-600 mb-1"><strong>Subject:</strong> {plan.subject}</p>
                      <p className="text-sm text-gray-600 mb-1"><strong>Grade:</strong> {plan.grade}</p>
                      <p className="text-sm text-gray-600 mb-3"><strong>Objective:</strong> {plan.objective}</p>
                      <p className="text-gray-700"><strong>AI Approach:</strong> {plan.approach}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {view === 'community' && (
              <div className="bg-white rounded-lg shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Community Shared Plans</h2>
                {communityPlans.length === 0 ? (
                  <p className="text-gray-600">No community plans yet. Be the first to share!</p>
                ) : (
                  <div className="space-y-4">
                    {communityPlans.map((plan, idx) => (
                      <div key={idx} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-xl font-bold text-gray-800">{plan.title}</h3>
                          <span className="text-xs text-gray-500">by {plan.sharedBy}</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-1"><strong>Subject:</strong> {plan.subject}</p>
                        <p className="text-sm text-gray-600 mb-1"><strong>Grade:</strong> {plan.gradeLevel}</p>
                        <p className="text-sm text-gray-700 mb-3">{plan.learningObjective}</p>
                        <p className="text-sm text-indigo-600"><strong>Approach:</strong> {plan.aiIntegration.approach}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Ethical Guidelines Sidebar */}
          <aside className="w-80 no-print">
            <div className="bg-white rounded-lg shadow-lg p-6 sticky top-4">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <AlertCircle className="text-indigo-600" size={20} />
                Ethical AI Guidelines
              </h3>
              
              <div className="space-y-4 text-sm text-gray-700">
                <div>
                  <h4 className="font-bold text-indigo-600 mb-1">Transparency</h4>
                  <p>Students should always know when AI is being used and cite it appropriately.</p>
                </div>
                
                <div>
                  <h4 className="font-bold text-indigo-600 mb-1">Verification</h4>
                  <p>Teach students to fact-check AI outputs against reliable sources.</p>
                </div>
                
                <div>
                  <h4 className="font-bold text-indigo-600 mb-1">Original Thinking</h4>
                  <p>AI should support, not replace, critical thinking and creativity.</p>
                </div>
                
                <div>
                  <h4 className="font-bold text-indigo-600 mb-1">Equity</h4>
                  <p>Ensure all students have equal access to AI tools and understand how to use them.</p>
                </div>
                
                <div>
                  <h4 className="font-bold text-indigo-600 mb-1">Privacy</h4>
                  <p>Protect student data and teach responsible sharing of information with AI.</p>
                </div>
                
                <div>
                  <h4 className="font-bold text-indigo-600 mb-1">Bias Awareness</h4>
                  <p>Discuss how AI can perpetuate biases and teach critical evaluation.</p>
                </div>
              </div>
            </div>

            {currentUser && savedPlans.length > 0 && (
              <div className="bg-white rounded-lg shadow-lg p-6 mt-4">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Your Saved Plans</h3>
                <div className="space-y-2">
                  {savedPlans.slice(-5).reverse().map((plan, idx) => (
                    <div key={idx} className="text-sm p-3 bg-gray-50 rounded hover:bg-gray-100 cursor-pointer">
                      <p className="font-semibold text-gray-800 truncate">{plan.title}</p>
                      <p className="text-xs text-gray-600">{plan.subject} • {plan.gradeLevel}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>

      {/* Auth Modal */}
      {showAuth && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 no-print">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Sign In</h2>
            <p className="text-gray-600 mb-6">Sign in with your Google account to save and share lesson plans.</p>
            <button
              onClick={loginWithGoogle}
              className="w-full bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition font-semibold flex items-center justify-center gap-2"
            >
              <LogIn size={20} />
              Sign in with Google
            </button>
            <button
              onClick={() => setShowAuth(false)}
              className="mt-4 w-full text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 no-print">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Settings</h2>
            
            {!currentUser && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-yellow-800">
                  ⚠️ You need to log in to save settings. Settings will be temporary until you sign in.
                </p>
              </div>
            )}
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  OpenAI API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">For API-based integration</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Custom GPT Link
                </label>
                <input
                  type="text"
                  value={gptLink}
                  onChange={(e) => setGptLink(e.target.value)}
                  placeholder="https://chat.openai.com/g/..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">For custom GPT integration</p>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={saveSettings}
                  className="flex-1 bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition font-semibold"
                >
                  {currentUser ? 'Save Settings' : 'Set Temporarily'}
                </button>
                <button
                  onClick={() => setShowSettings(false)}
                  className="flex-1 bg-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-400 transition font-semibold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
