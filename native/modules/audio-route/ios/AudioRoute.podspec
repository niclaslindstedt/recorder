# SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
# The local Expo module behind the Microphone sheet's routes (see ../index.ts).
# Autolinked from ../expo-module.config.json — there is no npm package here.

Pod::Spec.new do |s|
  s.name           = 'AudioRoute'
  s.version        = '1.0.0'
  s.summary        = "Prefers the audio session's microphone and output"
  s.description    = "Lists the audio session's inputs and outputs, prefers the ones the page chose, and says when the route changes."
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,swift}"
end
