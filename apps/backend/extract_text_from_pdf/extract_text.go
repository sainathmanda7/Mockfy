package extract_text_from_pdf

import (
	"bytes"
	"github.com/ledongthuc/pdf"
)

func ExtractText(fileBytes []byte, size int64) (string, error) {
	reader, err := pdf.NewReader(bytes.NewReader(fileBytes), size)
	if err != nil {
		return "", err
	}

	var rawText bytes.Buffer
	b, err := reader.GetPlainText()
	if err != nil {
		return "", err
	}
	
	rawText.ReadFrom(b)
	return rawText.String(), nil
}