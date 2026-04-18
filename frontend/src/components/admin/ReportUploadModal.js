import React, { useState, useEffect, useRef } from 'react';
import {
  X, Upload, FileText, Image, Trash2, CheckCircle,
  AlertCircle, Download, Loader, FilePlus
} from 'lucide-react';
import { uploadReports, deleteReport, getBookingReports } from '../../utils/api';
import toast from 'react-hot-toast';
import './ReportUploadModal.css';

const ICON_MAP = {
  'application/pdf': <FileText size={20} color="#E74C3C"/>,
  'image/jpeg':      <Image    size={20} color="#3498DB"/>,
  'image/png':       <Image    size={20} color="#3498DB"/>,
  'image/webp':      <Image    size={20} color="#3498DB"/>,
};

const fmt = (bytes) => {
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function ReportUploadModal({ booking, onClose, onUploaded }) {
  const [existingReports, setExistingReports] = useState([]);
  const [selectedFiles,   setSelectedFiles]   = useState([]);
  const [notes,           setNotes]           = useState('');
  const [uploading,       setUploading]       = useState(false);
  const [loadingReports,  setLoadingReports]  = useState(true);
  const [dragOver,        setDragOver]        = useState(false);
  const fileInputRef = useRef();

  const fetchReports = () => {
    setLoadingReports(true);
    getBookingReports(booking.id)
      .then(r => setExistingReports(r.data.reports))
      .catch(() => {})
      .finally(() => setLoadingReports(false));
  };

  useEffect(() => { fetchReports(); }, [booking.id]);

  /* ── File selection ── */
  const addFiles = (rawFiles) => {
    const valid = [];
    const ALLOWED = ['application/pdf','image/jpeg','image/png','image/webp'];
    const MAX_MB  = 20;
    Array.from(rawFiles).forEach(f => {
      if (!ALLOWED.includes(f.type)) {
        toast.error(`${f.name}: only PDF / JPG / PNG / WEBP allowed`);
        return;
      }
      if (f.size > MAX_MB * 1024 * 1024) {
        toast.error(`${f.name}: exceeds 20 MB limit`);
        return;
      }
      if (selectedFiles.find(s => s.name === f.name && s.size === f.size)) return; // skip dup
      valid.push(f);
    });
    setSelectedFiles(prev => [...prev, ...valid]);
  };

  const handleFileInput  = (e) => addFiles(e.target.files);
  const handleDrop       = (e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); };
  const handleDragOver   = (e) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave  = ()  => setDragOver(false);
  const removeSelected   = (idx) => setSelectedFiles(prev => prev.filter((_, i) => i !== idx));

  /* ── Upload ── */
  const handleUpload = async () => {
    if (!selectedFiles.length) return toast.error('Please select at least one file');
    setUploading(true);
    try {
      const fd = new FormData();
      selectedFiles.forEach(f => fd.append('reports', f));
      if (notes.trim()) fd.append('notes', notes.trim());

      await uploadReports(booking.id, fd);
      toast.success(`${selectedFiles.length} report(s) uploaded!`);
      setSelectedFiles([]);
      setNotes('');
      fetchReports();
      onUploaded?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  /* ── Delete existing ── */
  const handleDelete = async (report) => {
    if (!window.confirm(`Delete "${report.file_name}"? This cannot be undone.`)) return;
    try {
      await deleteReport(report.id);
      toast.success('Report deleted');
      fetchReports();
      onUploaded?.();
    } catch {
      toast.error('Delete failed');
    }
  };

  /* ── Download token URL (uses auth token in header — open via fetch) ── */
  const handleDownload = async (report) => {
    try {
      const token = localStorage.getItem('token');
      const res   = await fetch(`/api/reports/${report.id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = report.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal rum-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header">
          <div>
            <div className="modal-title">Manage Reports</div>
            <div className="rum-booking-ref">
              Booking #{booking.booking_number} — {booking.patient_name}
            </div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={onClose}><X size={14}/></button>
        </div>

        <div className="modal-body rum-body">

          {/* ── Existing Reports ── */}
          <div className="rum-section">
            <div className="rum-section-title">
              <CheckCircle size={15}/> Uploaded Reports
              <span className="rum-count">{existingReports.length}</span>
            </div>

            {loadingReports ? (
              <div className="rum-loading"><Loader size={20} className="rum-spin"/> Loading…</div>
            ) : existingReports.length === 0 ? (
              <div className="rum-empty">No reports uploaded yet</div>
            ) : (
              <div className="rum-existing-list">
                {existingReports.map(r => (
                  <div key={r.id} className="rum-existing-item">
                    <div className="rum-ei-icon">
                      {ICON_MAP[r.mime_type] || <FileText size={20}/>}
                    </div>
                    <div className="rum-ei-info">
                      <div className="rum-ei-name" title={r.file_name}>{r.file_name}</div>
                      <div className="rum-ei-meta">
                        {fmt(r.file_size)} &nbsp;·&nbsp;
                        Uploaded {new Date(r.created_at).toLocaleString('en-IN', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                        &nbsp;by {r.uploaded_by_name}
                        {r.notes && <><br/><span className="rum-ei-notes">📝 {r.notes}</span></>}
                      </div>
                    </div>
                    <div className="rum-ei-actions">
                      <button className="btn btn-outline btn-sm" onClick={() => handleDownload(r)} title="Download">
                        <Download size={12}/>
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r)} title="Delete">
                        <Trash2 size={12}/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Upload New ── */}
          <div className="rum-section">
            <div className="rum-section-title"><FilePlus size={15}/> Upload New Report(s)</div>

            {/* Drop zone */}
            <div
              className={`rum-dropzone ${dragOver ? 'drag-over' : ''}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                style={{ display: 'none' }}
                onChange={handleFileInput}
              />
              <Upload size={32} className="rum-dz-icon"/>
              <div className="rum-dz-title">Drag & drop files here, or click to browse</div>
              <div className="rum-dz-hint">PDF, JPG, PNG, WEBP · Max 20 MB per file · Up to 10 files at once</div>
            </div>

            {/* Selected file previews */}
            {selectedFiles.length > 0 && (
              <div className="rum-selected-list">
                {selectedFiles.map((f, idx) => (
                  <div key={idx} className="rum-selected-item">
                    <div className="rum-si-icon">
                      {ICON_MAP[f.type] || <FileText size={18}/>}
                    </div>
                    <div className="rum-si-info">
                      <div className="rum-si-name">{f.name}</div>
                      <div className="rum-si-size">{fmt(f.size)}</div>
                    </div>
                    <button className="rum-si-remove" onClick={() => removeSelected(idx)}>
                      <X size={14}/>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Notes */}
            <div className="form-group" style={{ marginTop: 14 }}>
              <label className="form-label">Lab Notes (optional)</label>
              <textarea
                className="form-control"
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. All values within normal range. Please review page 2 for lipid panel details."
              />
            </div>

            {/* Tip */}
            <div className="rum-tip">
              <AlertCircle size={13}/>
              Uploading reports will automatically update the booking status to <strong>Completed</strong> if it was in Processing or Sample Collected state.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Close</button>
          <button
            className="btn btn-primary"
            onClick={handleUpload}
            disabled={uploading || selectedFiles.length === 0}
          >
            {uploading
              ? <><Loader size={14} className="rum-spin"/> Uploading…</>
              : <><Upload size={14}/> Upload {selectedFiles.length > 0 ? `${selectedFiles.length} File(s)` : 'Reports'}</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}