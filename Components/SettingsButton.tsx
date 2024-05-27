import React from 'react';
import {TouchableOpacity, Text, StyleSheet} from 'react-native';
import {ServiceButtonProps} from '../types';

const styles = StyleSheet.create({
  serviceButton: {
    backgroundColor: '#7A82E2',
    borderRadius: 30,
    paddingVertical: 8,
    paddingHorizontal: 16,
    margin: 5,
    height: 50,
    width: 100,
    justifyContent: 'center',
  },
  serviceButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Montserrat-Bold',
    textAlign: 'center',
  },
  noneButton: {
    backgroundColor: '#F9F0F0',
  },
  noneText: {
    color: '#F07476',
  },
});

export const SettingsButton: React.FC<ServiceButtonProps> = ({
  text,
  onPress,
  style = {},
}) => {
  const none = text === 'Change topic';
  return (
    <TouchableOpacity
      style={[styles.serviceButton, style, none && styles.noneButton]}
      onPress={onPress}>
      <Text style={[styles.serviceButtonText, none && styles.noneText]}>
        {text}
      </Text>
    </TouchableOpacity>
  );
};