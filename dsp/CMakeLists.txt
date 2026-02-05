cmake_minimum_required(VERSION 3.24)
project(KickWithReverbDSP VERSION 0.0.1)

set(CMAKE_CXX_STANDARD 20)

# CPM package manager
set(CPM_DOWNLOAD_VERSION 0.42.0)
set(CPM_DOWNLOAD_LOCATION "${CMAKE_BINARY_DIR}/cmake/CPM_${CPM_DOWNLOAD_VERSION}.cmake")
if (NOT EXISTS ${CPM_DOWNLOAD_LOCATION})
    file(DOWNLOAD https://github.com/cpm-cmake/CPM.cmake/releases/download/v${CPM_DOWNLOAD_VERSION}/CPM.cmake ${CPM_DOWNLOAD_LOCATION})
endif()
include(${CPM_DOWNLOAD_LOCATION})

CPMAddPackage(
  NAME juce
  GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
  GIT_TAG 8.0.12
)

# Patch JUCE for Emscripten/WASM compatibility
if(EMSCRIPTEN)
  set(_juce_src "${juce_SOURCE_DIR}/modules/juce_core/native")

  # Fix: thread priorities table has no WASM entries
  file(READ "${_juce_src}/juce_ThreadPriorities_native.h" _tp_content)
  string(REPLACE "JUCE_LINUX || JUCE_BSD" "JUCE_LINUX || JUCE_BSD || JUCE_WASM" _tp_content "${_tp_content}")
  file(WRITE "${_juce_src}/juce_ThreadPriorities_native.h" "${_tp_content}")

  # Fix: missing emscripten.h include for emscripten_get_now()
  file(READ "${_juce_src}/juce_SystemStats_wasm.cpp" _ss_content)
  string(FIND "${_ss_content}" "#include <emscripten.h>" _found)
  if(_found EQUAL -1)
    string(PREPEND _ss_content "#include <emscripten.h>\n")
    file(WRITE "${_juce_src}/juce_SystemStats_wasm.cpp" "${_ss_content}")
  endif()
endif()

add_executable(audio-engine
  audio_engine.cpp
  sample_player.cpp
  distortion.cpp
  ott.cpp
  convolution.cpp
)

target_compile_definitions(audio-engine PRIVATE
    JUCE_USE_CURL=0
    JUCE_WEB_BROWSER=0
)

target_link_libraries(audio-engine PRIVATE
  juce::juce_core
  juce::juce_audio_basics
  juce::juce_dsp
)

# Emscripten linker flags
target_link_options(audio-engine PRIVATE
    --bind
    "SHELL:-s MODULARIZE=1"
    "SHELL:-s EXPORT_NAME=createAudioEngine"
    "SHELL:-s ENVIRONMENT=web,worker,shell"
    "SHELL:-s SINGLE_FILE=1"
    "SHELL:-s EXPORTED_FUNCTIONS=['_malloc','_free']"
    "SHELL:-s EXPORTED_RUNTIME_METHODS=['ccall','cwrap','HEAPF32']"
    "SHELL:-s ALLOW_MEMORY_GROWTH=1"
    "SHELL:-s INITIAL_MEMORY=67108864"
)

# Output into react/public/
set_target_properties(audio-engine PROPERTIES
    OUTPUT_NAME "audio-engine"
    SUFFIX ".js"
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_SOURCE_DIR}/../react/public"
)
