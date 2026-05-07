import React, { useRef, useState } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { theme } from '../theme';

interface Props {
  length?: number;
  onComplete: (code: string) => void;
}

export function OtpInput({ length = 6, onComplete }: Props) {
  const [code, setCode] = useState<string[]>(Array(length).fill(''));
  const refs = useRef<(TextInput | null)[]>([]);

  const handleChange = (text: string, index: number) => {
    // Handle paste (full code pasted at once)
    if (text.length > 1) {
      const digits = text.replace(/\D/g, '').slice(0, length).split('');
      const newCode = [...code];
      digits.forEach((d, i) => { if (index + i < length) newCode[index + i] = d; });
      setCode(newCode);
      const nextEmpty = newCode.findIndex(c => !c);
      if (nextEmpty >= 0) refs.current[nextEmpty]?.focus();
      else refs.current[length - 1]?.blur();
      if (newCode.every(c => c)) onComplete(newCode.join(''));
      return;
    }

    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    if (text && index < length - 1) {
      refs.current[index + 1]?.focus();
    }

    if (newCode.every(c => c)) {
      onComplete(newCode.join(''));
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      const newCode = [...code];
      newCode[index - 1] = '';
      setCode(newCode);
      refs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={styles.row}>
      {code.map((digit, i) => (
        <TextInput
          key={i}
          ref={el => { refs.current[i] = el; }}
          style={[styles.box, digit ? styles.boxFilled : undefined]}
          value={digit}
          onChangeText={text => handleChange(text, i)}
          onKeyPress={e => handleKeyPress(e, i)}
          keyboardType="number-pad"
          maxLength={i === 0 ? length : 1}
          selectTextOnFocus
          autoFocus={i === 0}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row:       { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  box:       { width: 48, height: 56, borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, color: theme.text, fontSize: 22, fontWeight: '500', textAlign: 'center' },
  boxFilled: { borderColor: theme.accent, backgroundColor: theme.accentDim },
});
