package audio

import "encoding/binary"

// CreateWAVHeader generates a standard 44-byte WAV header for the given PCM properties.
func CreateWAVHeader(dataSize uint32, sampleRate uint32, channels uint16, bitsPerSample uint16) []byte {
	header := make([]byte, 44)
	copy(header[0:4], []byte("RIFF"))
	binary.LittleEndian.PutUint32(header[4:8], dataSize+36)
	copy(header[8:12], []byte("WAVE"))
	copy(header[12:16], []byte("fmt "))
	
	// Chunk size and format
	binary.LittleEndian.PutUint32(header[16:20], 16)
	binary.LittleEndian.PutUint16(header[20:22], 1)
	binary.LittleEndian.PutUint16(header[22:24], channels)
	binary.LittleEndian.PutUint32(header[24:28], sampleRate)
	
	byteRate := sampleRate * uint32(channels) * uint32(bitsPerSample/8)
	binary.LittleEndian.PutUint32(header[28:32], byteRate)
	
	blockAlign := channels * (bitsPerSample / 8)
	binary.LittleEndian.PutUint16(header[32:34], blockAlign)
	binary.LittleEndian.PutUint16(header[34:36], bitsPerSample)
	
	// Data subchunk
	copy(header[36:40], []byte("data"))
	binary.LittleEndian.PutUint32(header[40:44], dataSize)
	
	return header
}
