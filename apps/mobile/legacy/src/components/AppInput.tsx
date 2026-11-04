import React, { useState } from 'react'
import { TextInput, TextInputProps, StyleSheet, ViewStyle } from 'react-native'
import { theme } from '../theme'

interface AppInputProps extends TextInputProps {
  containerStyle?: ViewStyle
}

export function AppInput({ style, containerStyle, ...props }: AppInputProps) {
  const [focused, setFocused] = useState(false)

  return (
    <TextInput
      style={[
        styles.input,
        focused && styles.inputFocused,
        style,
      ]}
      placeholderTextColor={theme.inputPlaceholder}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      {...props}
    />
  )
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: theme.inputBg,
    color: theme.inputText,
    borderColor: theme.inputBorder,
    borderWidth: 0.5,
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 16,
    fontSize: 15,
    fontWeight: '400',
  },
  inputFocused: {
    borderColor: theme.accent,
    borderWidth: 1,
  },
})
