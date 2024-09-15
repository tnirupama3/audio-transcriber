import math
import numpy as np
import pandas as pd
import librosa
import soundfile as sf
from speechbrain.pretrained import VAD
import matplotlib.pyplot as plt
import matplotlib.ticker as ticker


def detect_voice(
    path,
    activation_threshold=0.70,
    deactivation_threshold=0.25,
    min_pause=0.200,
    min_activation=0.100,
    save_dir='model_dir',
    segment_pre=0.0,
    segment_post=0.0,
    double_check_threshold=None,
    parallel_chunks=4,
    chunk_size=1.0,
    overlap_chunks=True,
    sr=16000,
):
    """Detects speech segments using the SpeechBrain VAD model."""

    # Load audio and resample to 16kHz if necessary
    audio, original_sr = librosa.load(path, sr=None)
    if original_sr != sr:
        print(f"Resampling audio from {original_sr} Hz to {sr} Hz...")
        audio = librosa.resample(audio, orig_sr=original_sr, target_sr=sr)
        # Overwrite the file with the resampled audio
        sf.write(path, audio, sr)

    # Initialize VAD model
    vad = VAD.from_hparams(
        source="speechbrain/vad-crdnn-libriparty", savedir=save_dir
    )

    # Get speech probability
    probabilities = vad.get_speech_prob_file(
        path,
        large_chunk_size=chunk_size * parallel_chunks,
        small_chunk_size=chunk_size,
        overlap_small_chunk=overlap_chunks,
    )

    # Apply thresholds to detect boundaries
    thresholded = vad.apply_threshold(
        probabilities, activation_th=activation_threshold, deactivation_th=deactivation_threshold
    ).float()

    boundaries = vad.get_boundaries(thresholded)

    # Refine boundaries using energy-based VAD
    boundaries = vad.energy_VAD(
        path, boundaries, activation_th=activation_threshold, deactivation_th=deactivation_threshold
    )

    # Merge short pauses and remove short segments
    if min_pause is not None:
        boundaries = vad.merge_close_segments(boundaries, close_th=min_pause)
    if min_activation is not None:
        boundaries = vad.remove_short_segments(
            boundaries, len_th=min_activation)
    if double_check_threshold:
        boundaries = vad.double_check_speech_segments(
            boundaries, speech_th=double_check_threshold
        )

    # Convert to DataFrame
    events = pd.DataFrame(boundaries, columns=['start', 'end'])
    events['class'] = 'speech'

    # Convert probabilities to pandas DataFrame
    p = np.squeeze(probabilities)
    times = pd.Series(np.arange(0, len(p)) * vad.time_resolution, name='time')
    p = pd.DataFrame(p, columns=['speech'], index=times)

    return p, events


def apply_gain(path, segments, default_gain=-20.0, out=None, sr=None):
    """Applies gain to non-speech segments."""
    audio, sr = sf.read(path, always_2d=True)

    # Initialize gains array
    gains = np.full_like(audio, librosa.db_to_power(default_gain))

    for idx, seg in segments.iterrows():
        start_sample = math.floor(sr * seg['start'])
        end_sample = math.ceil(sr * seg['end'])
        gain_value = librosa.db_to_power(seg.get('gain', default_gain))

        # Apply gain to the segment
        gains[start_sample:end_sample, :] = gain_value

    # Apply gain to the audio
    audio = audio * gains

    if out is not None:
        sf.write(out, audio, samplerate=sr)

    return audio, sr


def plot_spectrogram(ax, path, sr=16000, hop_length=1024):
    """Plots the spectrogram for a given audio file."""
    audio, sr = librosa.load(path, sr=sr)
    S = librosa.feature.melspectrogram(y=audio, sr=sr, hop_length=hop_length)
    S_db = librosa.power_to_db(S, ref=np.max)

    img = librosa.display.specshow(S_db, sr=sr, hop_length=hop_length,
                                   x_axis='time', y_axis='mel', ax=ax)

    return S_db


def plot_vad(input_path, probabilities, boundaries, output_path):
    """Plots the VAD results, original, and processed spectrograms."""
    fig, (input_spec_ax, vad_ax, output_spec_ax) = plt.subplots(
        3, figsize=(10, 8), sharex=True
    )

    # Plot original audio spectrogram
    plot_spectrogram(ax=input_spec_ax, path=input_path)
    input_spec_ax.set_title('Original Audio Spectrogram')

    # Plot VAD results
    probabilities.reset_index().plot(ax=vad_ax, x='time', y='speech')
    vad_ax.set_title('VAD Speech Detection')

    for start, end in zip(boundaries['start'], boundaries['end']):
        vad_ax.axvspan(start, end, alpha=0.3, color='green')

    vad_ax.xaxis.set_minor_locator(ticker.MultipleLocator(1.0))
    vad_ax.grid(True, which='minor', axis='x')
    vad_ax.grid(True, which='major', axis='x')

    # Plot processed audio spectrogram
    plot_spectrogram(ax=output_spec_ax, path=output_path)
    output_spec_ax.set_title('Processed Audio Spectrogram')

    fig.tight_layout()
    return fig


# Usage Example
path = 'voiceandnot_16k.wav'
out_path = 'voice-suppressed.wav'

# Detect speech segments
prob, segments = detect_voice(path)

# Apply gain of -20dB to non-speech segments
segments['gain'] = 0.0  # Set speech segments gain to 0dB
apply_gain(path, segments, default_gain=-20.0, out=out_path)

# Plot VAD results and spectrograms
fig = plot_vad(path, prob, segments, out_path)
fig.savefig('vad-output.png')
