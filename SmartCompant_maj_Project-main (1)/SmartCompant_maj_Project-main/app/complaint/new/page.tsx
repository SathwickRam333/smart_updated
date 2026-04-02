'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import {
  FileText, Mic, Image as ImageIcon, MapPin,
  Upload, Loader2, X, CheckCircle, Info, Building2, Clock
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';

import { useAuth } from '@/contexts/AuthContext';
import { createComplaint } from '@/services/complaints.service';

import {
  CATEGORIES, DEPARTMENTS, DISTRICTS,
  CATEGORY_TO_DEPARTMENT, SLA_RULES
} from '@/lib/types';

/* ---------------- VALIDATION ---------------- */
const schema = z.object({
  title: z.string().min(10),
  description: z.string().min(30),
  category: z.string().min(1),
  address: z.string().min(5),
  district: z.string().min(1),
});

type FormData = z.infer<typeof schema>;

const PRIORITY: Record<string, 'high' | 'medium' | 'low'> = {
  police: 'high',
  electricity: 'high',
  water: 'medium',
  road: 'medium',
  sanitation: 'medium',
  healthcare: 'high',
  corruption: 'high',
  other: 'low',
};

/* ---------------- COMPONENT ---------------- */
export default function NewComplaintPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();

  const [inputType, setInputType] = useState<'text' | 'voice' | 'image'>('text');
  const [files, setFiles] = useState<File[]>([]);
  const [location, setLocation] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // AI Routing Info
  const [resolvedDept, setResolvedDept] = useState('');
  const [sla, setSla] = useState('');

  // Voice
  const recognitionRef = useRef<any>(null);
  const [isRecording, setIsRecording] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const category = watch('category');

  /* -------- AUTO ROUTING -------- */
  useEffect(() => {
    if (!category) return;

    const dept = CATEGORY_TO_DEPARTMENT[category];
    const prio = PRIORITY[category] || 'medium';
    const days = SLA_RULES[prio];

    setResolvedDept(dept);
    setSla(`${days} days (${prio})`);
  }, [category]);

  /* -------- LOCATION -------- */
  const getLocation = () => {
    navigator.geolocation.getCurrentPosition((pos) => {
      setLocation(pos.coords);
      toast({ title: 'Location captured' });
    });
  };

  /* -------- FILE -------- */
  const handleFile = (e: any) => {
    const f = Array.from(e.target.files || []);
    setFiles(f);
  };

  /* -------- VOICE -------- */
  const startVoice = () => {
    const Speech = (window as any).webkitSpeechRecognition;
    const rec = new Speech();
    recognitionRef.current = rec;

    rec.continuous = true;
    rec.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      setValue('description', text);
    };

    rec.start();
    setIsRecording(true);
  };

  const stopVoice = () => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  };

  /* -------- SUBMIT -------- */
  const onSubmit = async (data: FormData) => {
    if (!user) return router.push('/login');

    setLoading(true);
    const res = await createComplaint(
      {
        ...data,
        department: resolvedDept,
        inputType,
        location: {
          latitude: location?.latitude || 0,
          longitude: location?.longitude || 0,
          address: data.address,
          district: data.district,
        },
        attachments: files,
      },
      user.uid,
      user.displayName,
      user.email,
      user.phone
    );

    setLoading(false);

    if (res.success) {
      toast({ title: 'Submitted!', description: res.trackingId });
      router.push(`/track?id=${res.trackingId}`);
    }
  };

  /* ---------------- UI ---------------- */
  return (
    <div className="max-w-3xl mx-auto py-10 space-y-6">

      <h1 className="text-3xl font-bold">File Complaint</h1>

      <Card>
        <CardContent className="space-y-5 pt-6">

          {/* INPUT TYPE */}
          <div className="flex gap-2">
            <Button onClick={() => setInputType('text')}><FileText /></Button>
            <Button onClick={() => setInputType('voice')}><Mic /></Button>
            <Button onClick={() => setInputType('image')}><ImageIcon /></Button>
          </div>

          {/* VOICE */}
          {inputType === 'voice' && (
            <div className="flex gap-2">
              {!isRecording
                ? <Button onClick={startVoice}>Start</Button>
                : <Button onClick={stopVoice}>Stop</Button>}
            </div>
          )}

          {/* CATEGORY */}
          <Select onValueChange={(v) => setValue('category', v)}>
            <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* ROUTING INFO */}
          {resolvedDept && (
            <div className="p-3 bg-blue-50 rounded">
              <p className="flex gap-2 items-center">
                <Building2 /> {resolvedDept}
              </p>
              <p className="flex gap-2 items-center text-sm">
                <Clock /> {sla}
              </p>
            </div>
          )}

          {/* TITLE */}
          <Input placeholder="Title" {...register('title')} />
          {errors.title && <p>{errors.title.message}</p>}

          {/* DESC */}
          <Textarea placeholder="Description" {...register('description')} />

          {/* LOCATION */}
          <Button onClick={getLocation}>
            <MapPin /> Get GPS
          </Button>

          <Textarea placeholder="Address" {...register('address')} />

          <Select onValueChange={(v) => setValue('district', v)}>
            <SelectTrigger><SelectValue placeholder="District" /></SelectTrigger>
            <SelectContent>
              {DISTRICTS.map(d => (
                <SelectItem key={d} value={d}>{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* FILE */}
          <input type="file" multiple onChange={handleFile} />

          {files.map((f, i) => (
            <div key={i} className="flex justify-between">
              {f.name}
              <X onClick={() => setFiles(files.filter((_, x) => x !== i))} />
            </div>
          ))}

          {/* SUBMIT */}
          <Button onClick={handleSubmit(onSubmit)} disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : 'Submit'}
          </Button>

        </CardContent>
      </Card>
    </div>
  );
}
