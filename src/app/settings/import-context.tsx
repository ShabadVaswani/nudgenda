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

import { NeoCard } from '@/components/NeoCard';
import { OutlinedTitle } from '@/components/OutlinedTitle';
import { colors, fonts, spacing } from '@/constants/design';
import { extractPickedDocument } from '@/context/fileExtractor';
import { useImportedContext } from '@/context/ImportedContextProvider';
import { createImportedContext, normalizeImportedText } from '@/context/structure';

type Preview = {
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
  const { context, remove, replace } = useImportedContext();
  const [error, setError] = useState<string>();
  const [isReading, setIsReading] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [preview, setPreview] = useState<Preview>();

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/settings/calendar');
  };

  const previewPaste = () => {
    try {
      setError(undefined);
      setPreview({ sourceName: 'Pasted context', text: normalizeImportedText(pastedText) });
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
      setPreview({ sourceName: asset.name, text });
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : 'That file could not be imported.');
    } finally {
      setIsReading(false);
    }
  };

  const applyPreview = async () => {
    if (!preview) return;
    await replace(createImportedContext(preview.sourceName, preview.text));
    goBack();
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
            <Text style={styles.eyebrow}>PRIVATE UNTIL YOU CHAT</Text>
            <Text style={styles.cardTitle}>bring earlier context into Nudgenda</Text>
            <Text style={styles.body}>
              Extraction happens on this device. The original file is discarded after reading. The
              extracted context is sent to your selected OpenRouter model only when you chat, never
              to a Nudgenda server.
            </Text>
          </NeoCard>

          {context && !preview && (
            <NeoCard backgroundColor={colors.lime} style={styles.card}>
              <Text style={styles.eyebrow}>ACTIVE CONTEXT · {context.sourceName}</Text>
              <Text style={styles.cardTitle}>what the agent currently remembers</Text>
              <Text style={styles.body}>{context.structured.summary}</Text>
              <ContextList label="PREFERENCES" values={context.structured.preferences} />
              <ContextList label="CONSTRAINTS" values={context.structured.constraints} />
              <ContextList label="TASKS" values={context.structured.tasks} />
              <ContextList label="UNFINISHED" values={context.structured.unfinishedItems} />
              <Text numberOfLines={12} style={styles.rawPreview}>
                {context.extractedText}
              </Text>
              <Pressable
                onPress={() => void remove()}
                style={({ pressed }) => [styles.removeButton, pressed && styles.pressed]}>
                <Text style={styles.buttonText}>remove imported context</Text>
              </Pressable>
            </NeoCard>
          )}

          <NeoCard backgroundColor={colors.aqua} style={styles.card}>
            <Text style={styles.eyebrow}>PASTE TEXT</Text>
            <TextInput
              multiline
              onChangeText={(value) => {
                setPastedText(value);
                setPreview(undefined);
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
                Applying stores this extracted text locally. It will become untrusted reference
                context for future agent requests; it will not create events by itself.
              </Text>
              <View style={styles.actionRow}>
                <Pressable
                  onPress={() => setPreview(undefined)}
                  style={({ pressed }) => [styles.secondaryButton, styles.flex, pressed && styles.pressed]}>
                  <Text style={styles.buttonText}>discard</Text>
                </Pressable>
                <Pressable
                  onPress={() => void applyPreview()}
                  style={({ pressed }) => [styles.applyButton, styles.flex, pressed && styles.pressed]}>
                  <Text style={styles.buttonText}>apply context</Text>
                </Pressable>
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
