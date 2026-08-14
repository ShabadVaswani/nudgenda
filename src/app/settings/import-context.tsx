import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAgentSettings } from '@/agent/AgentSettingsProvider';
import { NeoCard } from '@/components/NeoCard';
import { OutlinedTitle } from '@/components/OutlinedTitle';
import { colors, fonts, spacing } from '@/constants/design';
import { extractPickedDocument } from '@/context/fileExtractor';
import {
  DEFAULT_NOTEBOOK_FILTER_MODEL,
  DEFAULT_NOTEBOOK_WRITER_MODEL,
  runContextNotebookPipeline,
  type ContextNotebookReport,
} from '@/context/contextNotebookPipeline';
import { normalizeImportedText } from '@/context/structure';
import { useMemory } from '@/memory/MemoryProvider';

type Preview = {
  sourceId: string;
  sourceName: string;
  text: string;
};

function ContextList({ label, values }: { label: string; values: string[] }) {
  if (!values.length) return null;
  return (
    <View style={styles.contextGroup}>
      <Text style={styles.groupLabel}>{label}</Text>
      {values.map((value) => (
        <Text key={`${label}-${value}`} style={styles.groupItem}>
          • {value}
        </Text>
      ))}
    </View>
  );
}

export default function ImportContextScreen() {
  const router = useRouter();
  const { apiKey, isConfigured } = useAgentSettings();
  const { addImportedNotebook, state: memory } = useMemory();
  const [error, setError] = useState<string>();
  const [isReading, setIsReading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [pipelineMessage, setPipelineMessage] = useState('');
  const [pipelineReport, setPipelineReport] = useState<ContextNotebookReport>();
  const [preview, setPreview] = useState<Preview>();

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/settings/calendar');
  };

  const previewPaste = () => {
    try {
      setError(undefined);
      setPipelineReport(undefined);
      setPreview({
        sourceId: `import-${Date.now()}`,
        sourceName: 'Pasted context',
        text: normalizeImportedText(pastedText),
      });
    } catch (pasteError) {
      setError(pasteError instanceof Error ? pasteError.message : 'That text could not be read.');
    }
  };

  const chooseFile = async () => {
    setError(undefined);
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: ['text/plain', 'text/markdown', 'application/json', 'application/pdf'],
    });
    if (result.canceled) return;

    setIsReading(true);
    try {
      const asset = result.assets[0];
      const text = await extractPickedDocument(asset);
      setPreview({ sourceId: `import-${Date.now()}`, sourceName: asset.name, text });
      setPipelineReport(undefined);
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : 'That file could not be imported.');
    } finally {
      setIsReading(false);
    }
  };

  const processPreview = async () => {
    if (!preview || !isConfigured) return;
    setError(undefined);
    setIsProcessing(true);
    setPipelineReport(undefined);
    try {
      const report = await runContextNotebookPipeline({
        apiKey,
        existingNotebook: memory.notebook,
        filterModel: DEFAULT_NOTEBOOK_FILTER_MODEL,
        onProgress: setPipelineMessage,
        sourceId: preview.sourceId,
        sourceName: preview.sourceName,
        text: preview.text,
        writerModel: DEFAULT_NOTEBOOK_WRITER_MODEL,
      });
      await addImportedNotebook({
        originalText: preview.text,
        report,
        sourceId: preview.sourceId,
        sourceName: preview.sourceName,
      });
      setPipelineReport(report);
      setPipelineMessage('Notebook updated');
    } catch (pipelineError) {
      setError(
        pipelineError instanceof Error ? pipelineError.message : 'The memory pipeline could not finish.',
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="Go back" hitSlop={12} onPress={goBack}>
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
          <OutlinedTitle style={styles.title}>IMPORT CONTEXT</OutlinedTitle>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <NeoCard backgroundColor={colors.periwinkle} style={styles.card}>
            <Text style={styles.eyebrow}>PRIVATE UNTIL YOU ANALYZE</Text>
            <Text style={styles.cardTitle}>bring earlier context into Nudgenda</Text>
            <Text style={styles.body}>
              Text extraction happens on this device. The source text is retained locally for
              provenance, while the original file is never uploaded. Context is sent to OpenRouter
              only when you choose analysis or later chat, never to a Nudgenda server.
            </Text>
          </NeoCard>

          {!!memory.sources.length && !preview && (
            <NeoCard backgroundColor={colors.lime} style={styles.card}>
              <Text style={styles.eyebrow}>
                ACTIVE MEMORY · {memory.sources.length} IMPORT{memory.sources.length === 1 ? '' : 'S'}
              </Text>
              <Text style={styles.cardTitle}>what the agent currently remembers</Text>
              <Text selectable style={styles.rawPreview}>{memory.notebook}</Text>
              <ContextList label="SOURCES" values={memory.sources.map((source) => source.name)} />
            </NeoCard>
          )}

          <NeoCard backgroundColor={colors.aqua} style={styles.card}>
            <Text style={styles.eyebrow}>PASTE TEXT</Text>
            <TextInput
              multiline
              onChangeText={(value) => {
                setPastedText(value);
                setPreview(undefined);
                setPipelineReport(undefined);
              }}
              placeholder="Paste an earlier conversation, notes, preferences, or unfinished tasks…"
              placeholderTextColor={colors.muted}
              style={styles.textArea}
              textAlignVertical="top"
              value={pastedText}
            />
            <Pressable
              disabled={!pastedText.trim()}
              onPress={previewPaste}
              style={({ pressed }) => [
                styles.secondaryButton,
                !pastedText.trim() && styles.disabled,
                pressed && styles.pressed,
              ]}>
              <Text style={styles.buttonText}>preview pasted text</Text>
            </Pressable>
          </NeoCard>

          <View style={styles.orRow}>
            <View style={styles.orRule} />
            <Text style={styles.orText}>or</Text>
            <View style={styles.orRule} />
          </View>

          <Pressable
            disabled={isReading}
            onPress={() => void chooseFile()}
            style={({ pressed }) => [styles.fileButton, pressed && styles.pressed]}>
            {isReading ? (
              <ActivityIndicator color={colors.ink} />
            ) : (
              <Text style={styles.fileButtonText}>choose TXT · MD · JSON · PDF</Text>
            )}
          </Pressable>

          {!!error && <Text style={styles.error}>{error}</Text>}

          {preview && (
            <NeoCard backgroundColor={colors.yellow} style={styles.card}>
              <Text style={styles.eyebrow}>PREVIEW · {preview.sourceName}</Text>
              <Text style={styles.cardTitle}>review before applying</Text>
              <Text numberOfLines={18} style={styles.rawPreview}>
                {preview.text}
              </Text>
              <Text style={styles.disclosure}>
                Processing asks {DEFAULT_NOTEBOOK_FILTER_MODEL} to select relevant user messages,
                then {DEFAULT_NOTEBOOK_WRITER_MODEL} updates the Markdown notebook from the original
                evidence. The API key is never stored with the notebook.
              </Text>
              {!pipelineReport && (
                <Pressable
                  disabled={isProcessing || !isConfigured}
                  onPress={() => void processPreview()}
                  style={({ pressed }) => [
                    styles.processButton,
                    (!isConfigured || isProcessing) && styles.disabled,
                    pressed && styles.pressed,
                  ]}>
                  {isProcessing ? (
                    <View style={styles.processingRow}>
                      <ActivityIndicator color={colors.ink} />
                      <Text style={styles.buttonText}>{pipelineMessage}</Text>
                    </View>
                  ) : (
                    <Text style={styles.buttonText}>
                      {isConfigured ? 'analyze and remember' : 'add OpenRouter key first'}
                    </Text>
                  )}
                </Pressable>
              )}
              {pipelineReport && (
                <View style={styles.pipelineResult}>
                  <Text style={styles.groupLabel}>MEMORY UPDATED</Text>
                  <Text selectable style={styles.rawPreview}>{pipelineReport.notebook}</Text>
                  <Text style={styles.disclosure}>
                    {pipelineReport.originalCharacters.toLocaleString()} source characters →{' '}
                    {pipelineReport.selectedEvidenceCount} relevant user messages · notebook stored
                    locally
                  </Text>
                </View>
              )}
              <View style={styles.actionRow}>
                {!pipelineReport && (
                  <Pressable
                    onPress={() => setPreview(undefined)}
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      styles.flex,
                      pressed && styles.pressed,
                    ]}>
                    <Text style={styles.buttonText}>discard</Text>
                  </Pressable>
                )}
                {pipelineReport && (
                  <Pressable
                    onPress={goBack}
                    style={({ pressed }) => [styles.applyButton, styles.flex, pressed && styles.pressed]}>
                    <Text style={styles.buttonText}>done</Text>
                  </Pressable>
                )}
              </View>
            </NeoCard>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.paper, flex: 1 },
  safeArea: { alignSelf: 'center', flex: 1, maxWidth: 820, width: '100%' },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  backIcon: { color: colors.ink, fontFamily: fonts.hand, fontSize: 42 },
  title: { flex: 1, fontSize: 29, letterSpacing: -1, lineHeight: 36 },
  content: { gap: spacing.lg, padding: spacing.lg },
  card: { gap: spacing.sm, padding: spacing.lg },
  eyebrow: { color: colors.ink, fontFamily: fonts.handBold, fontSize: 13 },
  cardTitle: { color: colors.ink, fontFamily: fonts.handBold, fontSize: 24 },
  body: { color: colors.ink, fontFamily: fonts.hand, fontSize: 16, lineHeight: 22 },
  textArea: {
    backgroundColor: colors.white,
    borderColor: colors.ink,
    borderRadius: 10,
    borderWidth: 2,
    color: colors.ink,
    fontFamily: fonts.hand,
    fontSize: 17,
    minHeight: 150,
    padding: spacing.md,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: colors.ink,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: spacing.md,
  },
  fileButton: {
    alignItems: 'center',
    backgroundColor: colors.yellow,
    borderColor: colors.ink,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    minHeight: 58,
    shadowColor: colors.ink,
    shadowOffset: { height: 4, width: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  fileButtonText: { color: colors.ink, fontFamily: fonts.handBold, fontSize: 18 },
  buttonText: { color: colors.ink, fontFamily: fonts.handBold, fontSize: 16 },
  applyButton: {
    alignItems: 'center',
    backgroundColor: colors.lime,
    borderColor: colors.ink,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: spacing.md,
  },
  processButton: {
    alignItems: 'center',
    backgroundColor: colors.periwinkle,
    borderColor: colors.ink,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: spacing.md,
  },
  processingRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  pipelineResult: {
    backgroundColor: colors.white,
    borderColor: colors.ink,
    borderRadius: 10,
    borderWidth: 2,
    gap: spacing.sm,
    padding: spacing.md,
  },
  removeButton: {
    alignItems: 'center',
    backgroundColor: colors.pink,
    borderColor: colors.ink,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    minHeight: 46,
  },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  rawPreview: {
    backgroundColor: colors.white,
    borderColor: colors.ink,
    borderRadius: 9,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: fonts.hand,
    fontSize: 15,
    lineHeight: 20,
    padding: spacing.md,
  },
  disclosure: { color: colors.muted, fontFamily: fonts.hand, fontSize: 14, lineHeight: 19 },
  contextGroup: { gap: 2 },
  groupLabel: { color: colors.ink, fontFamily: fonts.handBold, fontSize: 12 },
  groupItem: { color: colors.ink, fontFamily: fonts.hand, fontSize: 15, lineHeight: 20 },
  orRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  orRule: { backgroundColor: colors.muted, flex: 1, height: 1 },
  orText: { color: colors.muted, fontFamily: fonts.handBold, fontSize: 15 },
  error: { color: '#8A2739', fontFamily: fonts.handBold, fontSize: 15, textAlign: 'center' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.72, transform: [{ translateY: 1 }] },
});
