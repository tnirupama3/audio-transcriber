import webrtcvad
import wave
from pydub import AudioSegment
import io


def process_audio_with_vad(pcm_data, sample_rate=16000):
    print("\nEntered function for VAD processing")

    # Initialize the VAD (Voice Activity Detection)
    vad = webrtcvad.Vad()
    vad.set_mode(1)  # 0 to 3, higher value means more aggressive filtering

    # Frame duration in milliseconds and the number of samples per frame
    frame_duration = 30  # 30ms per frame
    # Multiply by 2 for 16-bit audio
    num_samples_per_frame = int(sample_rate * frame_duration / 1000 * 2)

    # List to hold the detected speech segments
    speech_segments = []

    # Loop through the PCM audio data in chunks of the calculated frame size
    for i in range(0, len(pcm_data), num_samples_per_frame):
        frame = pcm_data[i:i + num_samples_per_frame]

        # Pad the frame if it's smaller than the expected size
        if len(frame) < num_samples_per_frame:
            frame += b'\x00' * (num_samples_per_frame - len(frame))

        # Check if the frame contains speech
        try:
            if vad.is_speech(frame, sample_rate):
                speech_segments.append(frame)
        except Exception as e:
            print(f"Error while processing frame: {e}")
            raise ValueError("Error while processing frame")

    # Print the number of detected speech segments
    # print(f"Detected {len(speech_segments)} speech segments.")
    return speech_segments


def convert_wav_to_pcm(audio_data: bytes):
    try:
        audio = AudioSegment.from_wav(io.BytesIO(audio_data))
        audio = audio.set_channels(1).set_frame_rate(16000)
        buffer = io.BytesIO()
        audio.export(buffer, format="wav")
        return buffer.getvalue(), 16000
    except Exception as e:
        raise ValueError(f"Error converting WAV to PCM: {str(e)}")
