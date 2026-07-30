package main

import (
	"bufio"
	"bytes"
	"compress/bzip2"
	"fmt"
	"io"

	"github.com/klauspost/compress/zstd"
)

// zstdMagic is the 4-byte frame magic number (RFC 8878) that starts every
// Zstandard stream, read as little-endian bytes.
var zstdMagic = []byte{0x28, 0xb5, 0x2f, 0xfd}

// decompressReplay detects and unwraps a replay download's compression.
// Valve's CDN has historically served bzip2 (the .dem.bz2 URL suffix), but
// some replays (observed via a GCS-backed edge cache tagging objects
// x-goog-meta-type: battlepass) are now zstd-compressed under the same
// .dem.bz2 extension, so the extension can't be trusted.
func decompressReplay(body io.Reader) (io.Reader, error) {
	br := bufio.NewReader(body)
	magic, err := br.Peek(len(zstdMagic))
	if err != nil && err != io.EOF {
		return nil, fmt.Errorf("read replay magic: %w", err)
	}
	if bytes.Equal(magic, zstdMagic) {
		zr, err := zstd.NewReader(br)
		if err != nil {
			return nil, fmt.Errorf("create zstd reader: %w", err)
		}
		return zr.IOReadCloser(), nil
	}
	return bzip2.NewReader(br), nil
}
