import { useEffect, useState } from 'react';
import { Upload, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/client';

interface BaseResume {
  id: string;
  fileName: string;
  label: string;
  isActive: boolean;
  contentText: string;
  updatedAt: string;
}

export default function ResumePage() {
  const [resumes, setResumes] = useState<BaseResume[]>([]);
  const [uploading, setUploading] = useState(false);

  const load = () => api.resume.getBase().then((r) => setResumes(r as BaseResume[])).catch(() => {});

  useEffect(() => {
    load();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await api.resume.uploadBase(file);
      toast.success('Base resume uploaded');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const active = resumes.find((r) => r.isActive) ?? resumes[0];

  return (
    <div className="p-7 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Resume Engine</h1>
        <p className="text-sm text-jp-text-muted mt-1">
          Upload your master resume, then tailor per job from the Jobs page
        </p>
      </div>

      <div className="card">
        <p className="section-title mb-4">Master Resume</p>
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-jp-border rounded-jp p-14 cursor-pointer hover:border-jp-accent transition-colors group">
          <Upload className="w-10 h-10 text-jp-text-muted mb-3 group-hover:text-jp-accent transition-colors" />
          <span className="text-sm text-jp-text-secondary">
            {uploading ? 'Uploading...' : 'Upload PDF or DOCX'}
          </span>
          <span className="text-xs text-jp-text-muted mt-1">Max 10 MB</span>
          <input
            type="file"
            accept=".pdf,.docx,.doc,.txt"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      </div>

      {active && (
        <div className="card">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-[10px] bg-jp-accent/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-jp-accent" />
            </div>
            <div>
              <p className="font-medium">{active.fileName}</p>
              <p className="text-xs text-jp-text-muted">
                Updated {new Date(active.updatedAt).toLocaleString()}
              </p>
            </div>
          </div>
          <pre className="text-xs whitespace-pre-wrap bg-jp-bg p-4 rounded-jp-sm max-h-96 overflow-auto font-mono text-jp-text-secondary leading-relaxed">
            {active.contentText.slice(0, 5000)}
            {active.contentText.length > 5000 && '\n\n... (truncated)'}
          </pre>
        </div>
      )}
    </div>
  );
}
