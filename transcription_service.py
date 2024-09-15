import speech_recognition as sr
from pydub import AudioSegment
from pydub.silence import split_on_silence


def transcribe_audio(speech_segments):
    recognizer = sr.Recognizer()
    transcription_result = ""
    combined_audio = AudioSegment.empty()

    # Combine all segments into a single AudioSegment
    for segment in speech_segments:
        segment_audio = AudioSegment(
            data=segment,
            sample_width=2,
            frame_rate=16000,
            channels=1
        )
        combined_audio += segment_audio

    # Apply noise reduction
    combined_audio = combined_audio.compress_dynamic_range()

    # Split audio on silence to get cleaner chunks
    chunks = split_on_silence(
        combined_audio,
        min_silence_len=500,
        silence_thresh=combined_audio.dBFS - 14,
        keep_silence=500
    )

    for i, chunk in enumerate(chunks):
        # Skip chunks that are too short (less than 0.5 seconds)
        if len(chunk) < 500:
            continue

        chunk_bytes = chunk.raw_data
        try:
            audio = sr.AudioData(chunk_bytes, 16000, 2)
            result = recognizer.recognize_google(
                audio, language="en-US", show_all=True)

            if result and 'alternative' in result:
                best_result = result['alternative'][0]
                if 'confidence' in best_result and best_result['confidence'] > 0.5:
                    transcription_result += best_result['transcript'].capitalize(
                    ) + ". "
                else:
                    transcription_result += "[Low Confidence] "
            else:
                transcription_result += "[Unintelligible] "

        except sr.UnknownValueError:
            pass
        except sr.RequestError as e:
            print(
                f"Could not request results from Google Speech Recognition service; {e}")
        except Exception as e:
            print(f"Error processing chunk {i + 1}: {e}")

    # Clean up the transcription
    transcription_result = transcription_result.replace(" .", ".")
    transcription_result = transcription_result.replace("  ", " ")

    return transcription_result.strip()
