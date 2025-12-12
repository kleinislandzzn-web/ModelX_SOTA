import React, { useState, useCallback, useRef } from 'react';
import { UserRole, TestPhase, UserSession, SingleEvalResult, ABTestResult } from './types';
import { Button } from './components/Button';
import { generateTestImage, generateComparisonPair } from './services/geminiService';
import { RatingSlider } from './components/RatingSlider';
import { ArrowRight, Image as ImageIcon, CheckCircle, AlertCircle, Sparkles, Scale, User, Upload, MessageSquare } from 'lucide-react';

// --- Constants ---
const INITIAL_METRICS = [
  { id: 'adherence', label: '提示词遵循度', score: 3, description: '图像是否准确反映了提示词的内容？' },
  { id: 'quality', label: '视觉保真度', score: 3, description: '清晰度、锐度以及噪点控制。' },
  { id: 'aesthetics', label: '美学质量', score: 3, description: '构图、光影及艺术表现力。' },
  { id: 'coherence', label: '结构连贯性', score: 3, description: '解剖结构、透视及物体逻辑是否合理。' }
];

const SUGGESTED_PROMPTS = [
  "火星上巨大的玻璃泡内建造的未来城市，电影级布光",
  "一只穿着文艺复兴时期皇家服饰的猫的油画，华丽的金框",
  "环保咖啡店的极简主义 Logo 设计，矢量风格，扁平化色彩",
  "东京的赛博朋克街头小吃摊贩，霓虹雨，细节纹理，8k"
];

const GENERAL_USER_SUGGESTIONS = [
  "帮我换个银灰色的短发，要很酷的那种",
  "把衣服换成复古的 90 年代牛仔外套",
  "把我变成皮克斯风格的 3D 卡通形象",
  "把背景换成《怪奇物语》里的霍金斯小镇"
];

const App: React.FC = () => {
  // State
  const [phase, setPhase] = useState<TestPhase>(TestPhase.ONBOARDING);
  const [session, setSession] = useState<UserSession>({
    role: UserRole.GENERAL_USER,
    experienceLevel: 5,
    singleEvals: [],
    abTests: []
  });

  // Test Logic State
  const [prompt, setPrompt] = useState('');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [comparisonImages, setComparisonImages] = useState<{A: string, B: string} | null>(null);
  const [metrics, setMetrics] = useState(INITIAL_METRICS);
  const [textFeedback, setTextFeedback] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Handlers ---

  const handleStart = (role: UserRole) => {
    setSession(prev => ({ ...prev, role }));
    
    // Workflow split: General Users go to User Input (Image upload), others to Generation Eval
    if (role === UserRole.GENERAL_USER) {
      setPhase(TestPhase.USER_INPUT);
    } else {
      setPhase(TestPhase.GENERATION_EVAL);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateSingle = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setGeneratedImage(null);
    
    try {
      const img = await generateTestImage(prompt);
      setGeneratedImage(img);
    } catch (e) {
      setError("生成图像失败，请重试。");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitSingleEval = () => {
    if (!generatedImage) return;
    
    const result: SingleEvalResult = {
      prompt,
      image: generatedImage,
      metrics: [...metrics],
      feedback: textFeedback,
      timestamp: Date.now()
    };

    setSession(prev => ({
      ...prev,
      singleEvals: [...prev.singleEvals, result]
    }));

    // Clean up
    setGeneratedImage(null);
    setPrompt('');
    setMetrics(INITIAL_METRICS.map(m => ({...m, score: 3})));
    setTextFeedback('');
    
    setPhase(TestPhase.AB_TEST);
  };

  // Triggered by General Users from USER_INPUT phase
  const handleGeneralUserSubmit = async () => {
    if (!uploadedImage || !prompt.trim()) return;
    
    setLoading(true);
    setPhase(TestPhase.AB_TEST); // Move UI to AB test layout immediately or show loading state there
    
    try {
      const { imageA, imageB } = await generateComparisonPair(prompt, uploadedImage);
      setComparisonImages({ A: imageA, B: imageB });
    } catch (e) {
      setError("图像处理失败，请重试。");
      setPhase(TestPhase.USER_INPUT); // Go back on error
    } finally {
      setLoading(false);
    }
  };

  const handleStartProfessionalABTest = async () => {
    const testPrompt = prompt.trim() || SUGGESTED_PROMPTS[Math.floor(Math.random() * SUGGESTED_PROMPTS.length)];
    setPrompt(testPrompt);
    setLoading(true);
    setError(null);

    try {
      const { imageA, imageB } = await generateComparisonPair(testPrompt);
      setComparisonImages({ A: imageA, B: imageB });
    } catch (e) {
      setError("生成对比图像失败。");
    } finally {
      setLoading(false);
    }
  };

  const handleABSelection = (selection: 'A' | 'B' | 'Equal') => {
    if (!comparisonImages) return;

    const result: ABTestResult = {
      prompt,
      sourceImage: uploadedImage || undefined,
      imageA: comparisonImages.A,
      imageB: comparisonImages.B,
      selectedImage: selection,
      reasoning: textFeedback,
      timestamp: Date.now()
    };

    setSession(prev => ({
      ...prev,
      abTests: [...prev.abTests, result]
    }));

    setPhase(TestPhase.COMPLETED);
  };

  // --- Render Functions ---

  const renderOnboarding = () => (
    <div className="max-w-2xl mx-auto pt-20 text-center px-4">
      <div className="mb-8 flex justify-center">
        <div className="p-4 bg-indigo-50 rounded-full ring-1 ring-indigo-100">
          <Sparkles className="w-12 h-12 text-indigo-600" />
        </div>
      </div>
      <h1 className="text-4xl md:text-5xl font-bold mb-6 text-slate-900 tracking-tight">
        Model X 体验测试
      </h1>
      <p className="text-xl text-slate-500 mb-12 leading-relaxed font-light">
        帮助我们塑造生成式 AI 的未来。<br/>
        根据您的身份，我们将提供专属的评测体验。
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
        {Object.values(UserRole).map((role) => (
          <button
            key={role}
            onClick={() => handleStart(role)}
            className="group relative p-6 bg-white border border-slate-200 rounded-xl hover:border-indigo-500 hover:shadow-md transition-all duration-300 shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-lg text-slate-800">{role}</span>
              <ArrowRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
            </div>
            <p className="text-sm text-slate-500 group-hover:text-slate-600">
              我是{role.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]\s/g, '')}
            </p>
          </button>
        ))}
      </div>
    </div>
  );

  // Specific for General Users: Upload + Intent
  const renderUserInput = () => (
    <div className="max-w-4xl mx-auto pt-12 px-4">
      <header className="mb-8 text-center">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">图生图创意测试</h2>
        <p className="text-slate-500">请上传一张您的照片，并告诉我们您希望 AI 如何改变它。</p>
      </header>

      <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-8 max-w-2xl mx-auto">
        {/* Image Upload Area */}
        <div 
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl h-64 flex flex-col items-center justify-center cursor-pointer transition-all mb-6 ${uploadedImage ? 'border-indigo-500/50 bg-indigo-50' : 'border-slate-300 hover:border-slate-400 hover:bg-slate-50'}`}
        >
           {uploadedImage ? (
             <img src={uploadedImage} alt="Uploaded" className="h-full object-contain p-2" />
           ) : (
             <>
               <Upload className="w-12 h-12 text-slate-400 mb-4" />
               <p className="text-slate-700 font-medium">点击上传图片</p>
               <p className="text-slate-400 text-sm mt-1">支持 JPG, PNG 格式</p>
             </>
           )}
           <input 
             type="file" 
             ref={fileInputRef} 
             onChange={handleImageUpload} 
             accept="image/*" 
             className="hidden" 
           />
        </div>

        {/* Intent Input */}
        <div className="mb-8">
           <label className="block text-sm font-medium text-slate-700 mb-2">
              您的创意意图
           </label>
           <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="发挥您的想象力... 比如：换个发型？穿越到火星？变成动漫主角？"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-4 text-slate-900 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all h-32 resize-none placeholder:text-slate-400"
            />
            
            <div className="mt-4">
              <p className="text-xs text-slate-500 mb-2 font-medium">试试这些好玩的指令：</p>
              <div className="flex flex-wrap gap-2">
                {GENERAL_USER_SUGGESTIONS.map((p, i) => (
                  <button 
                    key={i}
                    onClick={() => setPrompt(p)}
                    className="text-xs bg-slate-100 border border-slate-200 hover:bg-slate-200 text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-full transition-colors truncate max-w-full text-left"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
        </div>

        <Button 
          onClick={handleGeneralUserSubmit} 
          disabled={!uploadedImage || !prompt.trim()} 
          className="w-full text-lg py-4"
        >
          立即生成效果 <Sparkles className="w-4 h-4 ml-2" />
        </Button>
        
        {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-600 text-sm justify-center">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
        )}
      </div>
    </div>
  );

  // Professional Flow: Text to Image Single Eval
  const renderGenerationEval = () => (
    <div className="max-w-6xl mx-auto pt-8 px-4 h-full flex flex-col">
      <header className="flex items-center justify-between mb-8 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-600 text-white text-sm shadow-md shadow-indigo-200">1</span>
            专业模型能力测试
          </h2>
          <p className="text-slate-500 text-sm mt-1">测试模型对复杂提示词的理解与执行。</p>
        </div>
        <div className="text-xs font-mono text-slate-500 border border-slate-200 px-3 py-1 rounded-full bg-white">
          {session.role}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 grow">
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-2xl">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              输入提示词 (Prompt)
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="请输入包含特定风格、光影、构图要求的详细提示词..."
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-4 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all h-32 resize-none text-sm leading-relaxed"
            />
             <div className="mt-4">
              <p className="text-xs text-slate-500 mb-2 font-medium">灵感参考：</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_PROMPTS.slice(0,2).map((p, i) => (
                  <button key={i} onClick={() => setPrompt(p)} className="text-xs bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-full transition-colors truncate max-w-full text-left">
                    {p.substring(0, 15)}...
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={handleGenerateSingle} isLoading={loading} disabled={!prompt} className="w-full mt-6">
              生成测试图像
            </Button>
            {error && <div className="mt-4 p-3 bg-red-50 text-red-600 border border-red-200 text-sm rounded">{error}</div>}
          </div>

          {generatedImage && (
            <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h3 className="font-semibold text-slate-800 mb-4">维度评分</h3>
              <div className="space-y-1">
                {metrics.map((metric, idx) => (
                  <RatingSlider
                    key={metric.id}
                    label={metric.label}
                    description={metric.description}
                    value={metric.score}
                    onChange={(val) => {
                      const newMetrics = [...metrics];
                      newMetrics[idx].score = val;
                      setMetrics(newMetrics);
                    }}
                  />
                ))}
              </div>
              <Button onClick={handleSubmitSingleEval} className="w-full mt-6" variant="secondary">
                提交并进入对比测试
              </Button>
            </div>
          )}
        </div>

        <div className="lg:col-span-8 bg-slate-100 rounded-2xl border border-slate-200 flex items-center justify-center p-8 relative overflow-hidden min-h-[500px]">
           <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
           {loading ? (
             <div className="flex flex-col items-center gap-4 z-10">
               <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-600 rounded-full animate-spin"></div>
               <p className="text-indigo-600 font-medium">渲染中...</p>
             </div>
          ) : generatedImage ? (
            <img src={generatedImage} alt="Generated" className="max-h-[70vh] max-w-full rounded-lg shadow-xl shadow-slate-300/50 object-contain relative z-10 bg-white" />
          ) : (
            <div className="text-center text-slate-400"><ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" /><p>等待输入...</p></div>
          )}
        </div>
      </div>
    </div>
  );

  const renderABTest = () => {
    const isGeneralUser = session.role === UserRole.GENERAL_USER;

    return (
      <div className="max-w-7xl mx-auto pt-8 px-4 h-full flex flex-col">
         <header className="flex items-center justify-between mb-8 border-b border-slate-200 pb-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-600 text-white text-sm shadow-md shadow-purple-200">{isGeneralUser ? '1' : '2'}</span>
              {isGeneralUser ? '效果对比抉择' : 'A/B 盲测对比'}
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              {isGeneralUser ? '基于您的原图，选出最符合您预期的效果。' : '哪个模型版本表现更佳？'}
            </p>
          </div>
        </header>
  
        {!comparisonImages && !loading && !isGeneralUser && (
          <div className="max-w-xl mx-auto text-center py-20">
            <Scale className="w-16 h-16 text-purple-500 mx-auto mb-6" />
            <h3 className="text-2xl font-semibold mb-4 text-slate-800">盲测挑战</h3>
            <div className="space-y-4">
               <input type="text" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="输入对比提示词" className="w-full bg-white border border-slate-200 rounded-lg p-3 text-center text-slate-800 shadow-sm" />
              <Button onClick={handleStartProfessionalABTest} className="w-full">开始对比</Button>
            </div>
          </div>
        )}
  
        {loading && (
          <div className="grow flex flex-col items-center justify-center min-h-[400px]">
             <div className="w-16 h-16 border-4 border-purple-500/20 border-t-purple-600 rounded-full animate-spin mb-4"></div>
             <p className="text-slate-500">
                {isGeneralUser ? '正在根据您的图片进行 AI 创作...' : '正在合成变体...'}
             </p>
          </div>
        )}
  
        {comparisonImages && !loading && (
          <div className="grow flex flex-col">
            <div className="flex justify-center mb-6">
                 {uploadedImage && (
                    <div className="flex flex-col items-center mr-8 opacity-70 scale-75 origin-right">
                        <img src={uploadedImage} className="h-16 w-16 object-cover rounded border border-slate-200 shadow-sm" alt="Source" />
                        <span className="text-xs mt-1 text-slate-500">原图</span>
                    </div>
                 )}
                 <div className="bg-white shadow-sm py-2 px-6 rounded-full border border-slate-200 flex items-center max-w-2xl">
                    <span className="text-slate-400 text-xs mr-2 uppercase font-bold tracking-wider">Prompt</span>
                    <span className="text-slate-800 font-medium truncate">{prompt}</span>
                 </div>
            </div>
  
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 grow mb-8">
              {['A', 'B'].map((ver) => (
                <div key={ver} className="flex flex-col gap-4">
                  <div 
                    className="relative group grow bg-slate-100 rounded-xl overflow-hidden border border-slate-200 hover:border-purple-400 hover:shadow-lg transition-all cursor-pointer" 
                    onClick={() => handleABSelection(ver as 'A' | 'B')}
                  >
                    <img src={ver === 'A' ? comparisonImages.A : comparisonImages.B} className="w-full h-full object-cover" alt={`Version ${ver}`} />
                    <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded text-slate-900 font-bold text-sm border border-slate-100 shadow-sm">
                      方案 {ver}
                    </div>
                    <div className="absolute inset-0 bg-purple-600/0 group-hover:bg-purple-600/10 transition-colors flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 bg-purple-600 text-white px-6 py-2 rounded-full font-semibold shadow-xl transform translate-y-4 group-hover:translate-y-0 transition-all">
                        我觉得这个更好
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Open Ended Question Section */}
            <div className="max-w-2xl mx-auto w-full bg-white shadow-sm border border-slate-200 p-6 rounded-xl mb-8">
                <div className="flex items-start gap-3 mb-4">
                    <MessageSquare className="w-5 h-5 text-indigo-500 mt-1" />
                    <div>
                        <h4 className="text-slate-900 font-medium">开放式反馈（必填）</h4>
                        <p className="text-sm text-slate-500">
                             {isGeneralUser 
                                ? "相比原图，AI 是否达到了您的预期？您选择该方案的原因是？" 
                                : "请具体描述两个版本的差异，以及您做出选择的技术/审美原因。"}
                        </p>
                    </div>
                </div>
                <textarea
                    value={textFeedback}
                    onChange={(e) => setTextFeedback(e.target.value)}
                    placeholder="您的反馈对我们至关重要..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition-colors h-24 mb-4"
                />
                
                <div className="flex gap-4">
                     <Button 
                        variant="outline" 
                        onClick={() => handleABSelection('Equal')} 
                        className="flex-1"
                        disabled={!textFeedback.trim()}
                     >
                        两者差不多
                    </Button>
                    <p className="text-xs text-slate-400 self-center">请先填写反馈再选择</p>
                </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCompleted = () => (
    <div className="max-w-2xl mx-auto pt-20 text-center px-4">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-50 text-green-600 mb-6 ring-1 ring-green-200">
        <CheckCircle className="w-10 h-10" />
      </div>
      <h2 className="text-3xl font-bold text-slate-900 mb-4">评估完成</h2>
      <p className="text-slate-500 mb-8">
        感谢您的贡献。您的反馈数据置信度极高，将直接用于模型微调。
      </p>
      
      <div className="bg-white border border-slate-200 rounded-xl p-6 text-left mb-8 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">会话数据</h3>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between py-2 border-b border-slate-100">
            <span className="text-slate-500">角色</span>
            <span className="text-slate-900">{session.role}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-100">
             <span className="text-slate-500">测试类型</span>
             <span className="text-slate-900">{session.singleEvals.length > 0 ? '文本生成 + 对比' : '图生图对比'}</span>
          </div>
           {session.abTests.length > 0 && (
             <>
               <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">您的选择</span>
                <span className="text-indigo-600 font-bold">方案 {session.abTests[0].selectedImage}</span>
              </div>
               <div className="flex flex-col py-2 gap-2">
                <span className="text-slate-500">反馈摘要</span>
                <span className="text-slate-600 italic bg-slate-50 p-2 rounded border border-slate-100">
                    "{session.abTests[0].reasoning}"
                </span>
              </div>
             </>
           )}
        </div>
      </div>

      <div className="flex gap-4 justify-center">
        <Button onClick={() => window.location.reload()} variant="outline">开始新会话</Button>
        <Button onClick={() => {
          const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(session, null, 2));
          const downloadAnchorNode = document.createElement('a');
          downloadAnchorNode.setAttribute("href", dataStr);
          downloadAnchorNode.setAttribute("download", "model_x_eval_results.json");
          document.body.appendChild(downloadAnchorNode);
          downloadAnchorNode.click();
          downloadAnchorNode.remove();
        }}>
          下载报告 (JSON)
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
       <nav className="h-16 border-b border-slate-200 flex items-center justify-between px-6 bg-white/80 backdrop-blur-md sticky top-0 z-50">
          <div className="flex items-center gap-2 font-bold text-lg tracking-tight text-slate-900">
            <div className="w-4 h-4 bg-indigo-600 rounded-sm"></div>
            Model X
          </div>
          {phase !== TestPhase.ONBOARDING && (
            <div className="flex items-center gap-4 text-xs font-medium text-slate-500">
              <div className="flex items-center gap-2">
                 <User className="w-3 h-3" />
                 {session.role.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]\s/g, '')}
              </div>
            </div>
          )}
       </nav>

      <main className="grow relative">
        {phase === TestPhase.ONBOARDING && renderOnboarding()}
        {phase === TestPhase.USER_INPUT && renderUserInput()}
        {phase === TestPhase.GENERATION_EVAL && renderGenerationEval()}
        {phase === TestPhase.AB_TEST && renderABTest()}
        {phase === TestPhase.COMPLETED && renderCompleted()}
      </main>
    </div>
  );
};

export default App;