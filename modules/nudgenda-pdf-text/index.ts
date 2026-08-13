import { requireNativeModule } from 'expo';

type NudgendaPdfTextModule = {
  extractTextAsync(uri: string): Promise<string>;
};

export default requireNativeModule<NudgendaPdfTextModule>('NudgendaPdfText');
