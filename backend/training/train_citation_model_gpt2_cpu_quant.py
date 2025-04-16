#!/usr/bin/env python
import argparse
import json
import os
import torch
from transformers import (
    GPT2LMHeadModel,
    GPT2Tokenizer,
    Trainer,
    TrainingArguments,
    DataCollatorForLanguageModeling
)
from torch.utils.data import Dataset

class CitationDataset(Dataset):
    def __init__(self, file_path, tokenizer, max_length=512):
        self.examples = []
        with open(file_path, encoding="utf-8") as f:
            for line in f:
                self.examples.append(json.loads(line))
        self.tokenizer = tokenizer
        self.max_length = max_length

    def __len__(self):
        return len(self.examples)

    def __getitem__(self, idx):
        item = self.examples[idx]
        # Combine input prompt and target citation.
        text = item["input"] + " " + item["target"]
        encoding = self.tokenizer(
            text,
            truncation=True,
            max_length=self.max_length,
            padding="max_length",
            return_tensors="pt"
        )
        # Remove extra batch dimension.
        encoding = {k: v.squeeze() for k, v in encoding.items()}
        return encoding

def main():
    parser = argparse.ArgumentParser(
        description="Fine-tune GPT-2 for citation generation, apply dynamic quantization on CPU, and save a final model repository."
    )
    parser.add_argument("--train_file", type=str, required=True, help="Path to the training data (JSONL format).")
    parser.add_argument("--eval_file", type=str, default=None, help="Path to the evaluation data (JSONL format).")
    parser.add_argument("--model_name_or_path", type=str, default="gpt2", help="Pretrained GPT-2 model name or path.")
    # Use a relative path for output; adjust this as needed.
    parser.add_argument("--output_dir", type=str, default="../training/citation_gpt2_model", help="Output directory for the final model repository.")
    parser.add_argument("--num_train_epochs", type=int, default=3, help="Number of training epochs.")
    parser.add_argument("--per_device_train_batch_size", type=int, default=4, help="Batch size per device during training.")
    parser.add_argument("--per_device_eval_batch_size", type=int, default=4, help="Batch size per device during evaluation.")
    parser.add_argument("--max_length", type=int, default=512, help="Maximum sequence length.")
    parser.add_argument("--learning_rate", type=float, default=5e-5, help="Learning rate.")
    args = parser.parse_args()

    # Resolve output_dir relative to this script's location.
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_dir = os.path.abspath(os.path.join(script_dir, args.output_dir))
    args.output_dir = output_dir

    print("Loading GPT-2 tokenizer and model...")
    tokenizer = GPT2Tokenizer.from_pretrained(args.model_name_or_path)
    # Set pad token (GPT-2 has no default pad token) to the EOS token.
    tokenizer.pad_token = tokenizer.eos_token
    model = GPT2LMHeadModel.from_pretrained(args.model_name_or_path)
    model.resize_token_embeddings(len(tokenizer))

    print("Preparing training dataset...")
    train_dataset = CitationDataset(args.train_file, tokenizer, args.max_length)
    eval_dataset = CitationDataset(args.eval_file, tokenizer, args.max_length) if args.eval_file else None
    data_collator = DataCollatorForLanguageModeling(tokenizer=tokenizer, mlm=False)

    training_args = TrainingArguments(
        output_dir=args.output_dir,
        num_train_epochs=args.num_train_epochs,
        per_device_train_batch_size=args.per_device_train_batch_size,
        per_device_eval_batch_size=args.per_device_eval_batch_size,
        evaluation_strategy="epoch" if eval_dataset is not None else "no",
        learning_rate=args.learning_rate,
        weight_decay=0.01,
        save_total_limit=2,
        logging_steps=100,
        logging_dir=os.path.join(args.output_dir, "logs"),
        report_to="none",
        prediction_loss_only=True,
    )

    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        data_collator=data_collator,
        tokenizer=tokenizer,
    )

    print("Starting training...")
    trainer.train()

    # Move the model to CPU to ensure quantization uses supported operations.
    print("Moving model to CPU for quantization...")
    model = model.to("cpu")
    
    # Set the quantized engine (qnnpack is commonly available on ARM-based systems).
    print("Setting quantized engine to 'qnnpack'...")
    torch.backends.quantized.engine = "qnnpack"

    print("Applying dynamic quantization...")
    quantized_model = torch.quantization.quantize_dynamic(
        model, {torch.nn.Linear}, dtype=torch.qint8
    )

    # Manually filter the state dictionary to remove non-tensor items (such as torch.dtype objects).
    state_dict = quantized_model.state_dict()
    filtered_state_dict = {k: v for k, v in state_dict.items() if isinstance(v, torch.Tensor)}

    # Make sure the output directory exists.
    os.makedirs(args.output_dir, exist_ok=True)
    output_model_file = os.path.join(args.output_dir, "pytorch_model.bin")
    print("Saving quantized model and tokenizer...")
    torch.save(filtered_state_dict, output_model_file)
    model.config.save_pretrained(args.output_dir)
    tokenizer.save_pretrained(args.output_dir)
    print(f"Model and tokenizer saved to {args.output_dir}")

if __name__ == "__main__":
    main()
