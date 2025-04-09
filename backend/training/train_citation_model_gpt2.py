#!/usr/bin/env python
import argparse
import json
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
        # For GPT-2, combine the prompt and target citation into one sequence.
        # You can choose a separator if desired; here we just put a space.
        text = item["input"] + " " + item["target"]
        encoding = self.tokenizer(
            text,
            truncation=True,
            max_length=self.max_length,
            padding="max_length",
            return_tensors="pt"
        )
        # Remove the extra batch dimension.
        encoding = {k: v.squeeze() for k, v in encoding.items()}
        return encoding

def main():
    parser = argparse.ArgumentParser(
        description="Fine-tune GPT-2 for citation generation."
    )
    parser.add_argument("--train_file", type=str, required=True, help="Path to the training data (JSONL format).")
    parser.add_argument("--eval_file", type=str, default=None, help="Path to the evaluation data (JSONL format).")
    parser.add_argument("--model_name_or_path", type=str, default="gpt2", help="Pretrained GPT-2 model name or path.")
    parser.add_argument("--output_dir", type=str, default="./citation_gpt2_model", help="Directory where the fine-tuned model will be saved.")
    parser.add_argument("--num_train_epochs", type=int, default=3, help="Number of training epochs.")
    parser.add_argument("--per_device_train_batch_size", type=int, default=4, help="Batch size per device during training.")
    parser.add_argument("--per_device_eval_batch_size", type=int, default=4, help="Batch size per device during evaluation.")
    parser.add_argument("--max_length", type=int, default=512, help="Maximum sequence length.")
    parser.add_argument("--learning_rate", type=float, default=5e-5, help="Learning rate.")
    args = parser.parse_args()

    print("Loading GPT-2 tokenizer and model...")
    tokenizer = GPT2Tokenizer.from_pretrained(args.model_name_or_path)
    # GPT-2 doesn't have a pad token; set it to the EOS token.
    tokenizer.pad_token = tokenizer.eos_token
    model = GPT2LMHeadModel.from_pretrained(args.model_name_or_path)
    model.resize_token_embeddings(len(tokenizer))

    print("Preparing training dataset...")
    train_dataset = CitationDataset(args.train_file, tokenizer, args.max_length)
    eval_dataset = None
    if args.eval_file is not None:
        eval_dataset = CitationDataset(args.eval_file, tokenizer, args.max_length)

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
        logging_dir="./logs",
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

    print("Saving the fine-tuned GPT-2 model...")
    trainer.save_model(args.output_dir)
    tokenizer.save_pretrained(args.output_dir)
    print(f"Model saved to {args.output_dir}")

if __name__ == "__main__":
    main()
