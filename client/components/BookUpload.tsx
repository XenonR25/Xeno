'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { CloudArrowUpIcon, DocumentIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { apiService } from '@/lib/api';
import { UploadProgress } from '@/types';
import toast from 'react-hot-toast';

interface BookUploadProps {
  onUploadSuccess?: (bookData: any) => void;
}

export default function BookUpload({ onUploadSuccess }: BookUploadProps) {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      toast.success('PDF file selected successfully!');
    } else {
      toast.error('Please select a valid PDF file');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: false,
    disabled: isUploading
  });

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a PDF file first');
      return;
    }

    setIsUploading(true);
    setUploadProgress({
      progress: 0,
      stage: 'uploading',
      message: 'Preparing upload...'
    });

    try {
      const result = await apiService.uploadBook(selectedFile, (progress) => {
        setUploadProgress({
          progress,
          stage: progress < 100 ? 'uploading' : 'processing',
          message: progress < 100 ? `Uploading... ${progress}%` : 'Processing PDF and extracting content...'
        });
      });

      if (result.status === 'success') {
        setUploadProgress({
          progress: 100,
          stage: 'completed',
          message: 'Book uploaded successfully!'
        });
        
        toast.success(`Book "${result.data?.book.Name}" uploaded successfully!`);
        
        if (onUploadSuccess) {
          onUploadSuccess(result.data);
        }
        
        // Reset form
        setSelectedFile(null);
        setTimeout(() => {
          setUploadProgress(null);
        }, 2000);
      } else {
        throw new Error(result.message || 'Upload failed');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      setUploadProgress({
        progress: 0,
        stage: 'error',
        message: error.response?.data?.message || error.message || 'Upload failed'
      });
      toast.error(error.response?.data?.message || 'Failed to upload book');
    } finally {
      setIsUploading(false);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setUploadProgress(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="card p-8">
        <div className="text-center mb-8">
          <CloudArrowUpIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Upload Your Book</h2>
          <p className="text-gray-400">
            Upload a PDF file to process and add to your library
          </p>
        </div>

        {!selectedFile ? (
          <div
            {...getRootProps()}
            className={`upload-zone cursor-pointer ${isDragActive ? 'active' : ''} ${
              isUploading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <input {...getInputProps()} />
            <CloudArrowUpIcon className="mx-auto h-16 w-16 text-gray-500 mb-4" />
            {isDragActive ? (
              <p className="text-lg text-white font-medium">Drop the PDF file here...</p>
            ) : (
              <div>
                <p className="text-lg text-gray-300 mb-2">
                  Drag and drop a PDF file here, or <span className="text-white font-medium">click to browse</span>
                </p>
                <p className="text-sm text-gray-500">Maximum file size: 50MB</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Selected File Display */}
            <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg border border-gray-700">
              <div className="flex items-center space-x-3">
                <DocumentIcon className="h-8 w-8 text-red-400" />
                <div>
                  <p className="font-medium text-white">{selectedFile.name}</p>
                  <p className="text-sm text-gray-400">{formatFileSize(selectedFile.size)}</p>
                </div>
              </div>
              {!isUploading && (
                <button
                  onClick={removeFile}
                  className="p-1 hover:bg-gray-700 rounded-full transition-colors"
                >
                  <XMarkIcon className="h-5 w-5 text-gray-400" />
                </button>
              )}
            </div>

            {/* Upload Progress */}
            {uploadProgress && (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">{uploadProgress.message}</span>
                  <span className="text-white font-medium">{uploadProgress.progress}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      uploadProgress.stage === 'error'
                        ? 'bg-red-500'
                        : uploadProgress.stage === 'completed'
                        ? 'bg-green-500'
                        : 'bg-white'
                    }`}
                    style={{ width: `${uploadProgress.progress}%` }}
                  />
                </div>
                {uploadProgress.stage === 'processing' && (
                  <div className="flex items-center justify-center space-x-2 text-sm text-gray-400">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Processing PDF and extracting book information...</span>
                  </div>
                )}
              </div>
            )}

            {/* Upload Button */}
            <div className="flex space-x-4">
              <button
                onClick={handleUpload}
                disabled={isUploading || uploadProgress?.stage === 'completed'}
                className={`flex-1 btn btn-primary ${
                  isUploading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {isUploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Uploading...
                  </>
                ) : uploadProgress?.stage === 'completed' ? (
                  'Upload Completed'
                ) : (
                  <>
                    <CloudArrowUpIcon className="h-4 w-4 mr-2" />
                    Upload Book
                  </>
                )}
              </button>
              
              {!isUploading && uploadProgress?.stage !== 'completed' && (
                <button
                  onClick={removeFile}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}

        {/* Upload Tips */}
        <div className="mt-8 p-4 bg-gray-800 rounded-lg border border-gray-700">
          <h3 className="text-sm font-medium text-white mb-2">Upload Tips:</h3>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>• Only PDF files are supported</li>
            <li>• Maximum file size is 50MB</li>
            <li>• The system will automatically extract book information and create page images</li>
            <li>• Processing time depends on the number of pages in your book</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
