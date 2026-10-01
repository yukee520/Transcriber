import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Clipboard from '@react-native-clipboard/clipboard';
import Toast from 'react-native-toast-message';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTranscript } from '@/hooks/useTranscript';
import { useDeleteTranscript } from '@/hooks/useTranscripts';
import ScreenHeader from '@/components/ScreenHeader';
import ErrorState from '@/components/ErrorState';
import LoadingSpinner from '@/components/LoadingSpinner';
import PlatformBadge from '@/components/PlatformBadge';
import Button from '@/components/Button';
import Card from '@/components/Card';
import showConfirmDialog from '@/components/ConfirmDialog';
import {
  formatDate,
  formatDuration,
  formatWordCount,
  formatTimestamp,
} from '@/utils/formatting';
import type { RootStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type DetailRoute = RouteProp<RootStackParamList, 'TranscriptDetail'>;

export default function TranscriptDetailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<DetailRoute>();
  const { transcriptId } = route.params;
  const { data, isLoading, isError, error, refetch } = useTranscript(transcriptId);
  const deleteMutation = useDeleteTranscript();
  const [segmentView, setSegmentView] = useState(true);

  const transcript = data ?? null;

  const handleCopy = useCallback(() => {
    if (!transcript) return;
    Clipboard.setString(transcript.text);
    Toast.show({
      type: 'success',
      text1: 'Copied',
      text2: 'Transcript copied to clipboard.',
      position: 'bottom',
    });
  }, [transcript]);

  const handleShare = useCallback(async () => {
    if (!transcript) return;
    try {
      await Share.share({
        title: transcript.videoTitle,
        message: `${transcript.videoTitle}\n${transcript.videoUrl}\n\n${transcript.text}`,
      });
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Could not share',
        position: 'bottom',
      });
    }
  }, [transcript]);

  const handleDelete = useCallback(() => {
    if (!transcript) return;
    showConfirmDialog({
      title: 'Delete transcript?',
      message:
        'This transcript will be permanently removed from your device. The creator will still be tracked.',
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: () => {
        deleteMutation.mutate(transcript.id, {
          onSuccess: () => navigation.goBack(),
        });
      },
    });
  }, [transcript, deleteMutation, navigation]);

  const displayText = useMemo(() => {
    if (!transcript) return '';
    if (!segmentView || transcript.segments.length === 0) {
      return transcript.text || 'Transcript is empty.';
    }
    return '';
  }, [transcript, segmentView]);

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
        <ScreenHeader title="Transcript" showBack />
        <LoadingSpinner fullScreen label="Loading transcript…" />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
        <ScreenHeader title="Transcript" showBack />
        <ErrorState
          message={error?.message ?? 'Could not load this transcript.'}
          onRetry={() => {
            void refetch();
          }}
        />
      </SafeAreaView>
    );
  }

  if (!transcript) {
    return (
      <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
        <ScreenHeader title="Transcript" showBack />
        <ErrorState
          title="Transcript not found"
          message="This transcript may have been deleted."
        />
      </SafeAreaView>
    );
  }

  const statusColor =
    transcript.status === 'completed'
      ? '#10B981'
      : transcript.status === 'failed'
        ? '#EF4444'
        : transcript.status === 'processing'
          ? '#2563EB'
          : '#94A3B8';

  return (
    <SafeAreaView className="flex-1 bg-background dark:bg-dark-background">
      <ScreenHeader
        title="Transcript"
        showBack
        right={
          <Pressable
            onPress={handleDelete}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Delete transcript"
          >
            <Ionicons name="trash-outline" size={22} color="#EF4444" />
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <Card className="mb-4">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 mr-2">
              <Text className="text-lg font-bold text-text dark:text-dark-text leading-6">
                {transcript.videoTitle}
              </Text>
              <Text className="text-sm text-muted dark:text-dark-muted mt-1">
                {transcript.creatorName} · @{transcript.creatorUsername}
              </Text>
            </View>
            <PlatformBadge platform={transcript.platform} />
          </View>

          <View className="flex-row flex-wrap items-center gap-3 mt-3">
            <View className="flex-row items-center">
              <Ionicons name="time-outline" size={14} color="#64748B" />
              <Text className="ml-1 text-xs text-muted dark:text-dark-muted">
                {formatDuration(transcript.durationSeconds)}
              </Text>
            </View>
            <View className="flex-row items-center">
              <Ionicons name="globe-outline" size={14} color="#64748B" />
              <Text className="ml-1 text-xs text-muted dark:text-dark-muted">
                {transcript.language.toUpperCase()}
              </Text>
            </View>
            <View className="flex-row items-center">
              <Ionicons name="text-outline" size={14} color="#64748B" />
              <Text className="ml-1 text-xs text-muted dark:text-dark-muted">
                {formatWordCount(transcript.wordCount)}
              </Text>
            </View>
            <View className="flex-row items-center">
              <Ionicons name="calendar-outline" size={14} color="#64748B" />
              <Text className="ml-1 text-xs text-muted dark:text-dark-muted">
                {formatDate(transcript.createdAt)}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center mt-3">
            <View
              className="w-2 h-2 rounded-full mr-2"
              style={{ backgroundColor: statusColor }}
            />
            <Text className="text-xs font-medium" style={{ color: statusColor }}>
              {transcript.status.charAt(0).toUpperCase() + transcript.status.slice(1)}
            </Text>
          </View>

          {transcript.errorMessage ? (
            <View className="mt-3 bg-danger/10 border border-danger/30 rounded-xl p-3">
              <Text className="text-sm text-danger leading-5">
                {transcript.errorMessage}
              </Text>
            </View>
          ) : null}
        </Card>

        {transcript.status === 'completed' ? (
          <>
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-base font-semibold text-text dark:text-dark-text">
                Transcript
              </Text>
              {transcript.segments.length > 0 ? (
                <Pressable
                  onPress={() => setSegmentView((v) => !v)}
                  accessibilityRole="button"
                  className="px-3 py-1 rounded-full border border-border dark:border-dark-border"
                >
                  <Text className="text-xs font-medium text-primary dark:text-primary">
                    {segmentView ? 'Plain text' : 'With timestamps'}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <Card>
              {segmentView && transcript.segments.length > 0 ? (
                <View>
                  {transcript.segments.map((seg, idx) => (
                    <View
                      key={`${seg.start}-${idx}`}
                      className="flex-row mb-3 last:mb-0"
                    >
                      <Text
                        className="text-xs font-mono text-primary dark:text-primary mt-0.5 w-14"
                      >
                        {formatTimestamp(seg.start)}
                      </Text>
                      <Text className="flex-1 text-sm text-text dark:text-dark-text leading-6">
                        {seg.text}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text className="text-sm text-text dark:text-dark-text leading-6">
                  {displayText}
                </Text>
              )}
            </Card>
          </>
        ) : transcript.status === 'processing' || transcript.status === 'pending' ? (
          <Card>
            <View className="items-center py-6">
              <ActivityIndicator size="large" color="#2563EB" />
              <Text className="mt-3 text-sm text-muted dark:text-dark-muted">
                Transcription in progress…
              </Text>
            </View>
          </Card>
        ) : null}

        <View className="flex-row gap-3 mt-5">
          <View className="flex-1">
            <Button
              label="Copy"
              onPress={handleCopy}
              variant="secondary"
              icon="copy-outline"
              fullWidth
              disabled={!transcript.text}
            />
          </View>
          <View className="flex-1">
            <Button
              label="Share"
              onPress={handleShare}
              variant="secondary"
              icon="share-outline"
              fullWidth
              disabled={!transcript.text}
            />
          </View>
          <View className="flex-1">
            <Button
              label="Open"
              onPress={() => {
                Toast.show({
                  type: 'info',
                  text1: 'Open in browser',
                  text2: transcript.videoUrl,
                  position: 'bottom',
                });
              }}
              variant="secondary"
              icon="open-outline"
              fullWidth
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}