# A/B Testing in Flow Builder

## Overview

SecreBot's Flow Builder now supports A/B testing for LLM prompts, allowing you to test different prompt variations to optimize user engagement and conversion rates.

## Features

### 🔀 Prompt Variants
- Multiple prompt versions for the same LLM node
- Automatic selection based on configured strategy
- Consistent user assignment across sessions

### 📊 Selection Strategies

#### 1. Random Selection
```json
{
  "selectionStrategy": "random"
}
```
- Equal probability for all variants
- Good for initial testing

#### 2. Weighted Selection
```json
{
  "selectionStrategy": "weighted",
  "weight": 40
}
```
- Assign different probabilities to variants
- Useful for gradual rollouts

#### 3. User Hash Selection
```json
{
  "selectionStrategy": "user_hash"
}
```
- Consistent assignment based on user ID
- Same user always gets same variant

## Configuration

### Basic LLM Node with A/B Testing

```json
{
  "id": "llm-node-1",
  "type": "llm",
  "data": {
    "label": "AI Assistant",
    "prompt": "Default prompt (fallback)",
    "promptVariants": [
      {
        "id": "variant-a",
        "name": "Formal Tone",
        "prompt": "Professionally assist the user with their query...",
        "weight": 50,
        "selectionStrategy": "weighted"
      },
      {
        "id": "variant-b", 
        "name": "Casual Tone",
        "prompt": "Hey! Let me help you with that...",
        "weight": 50,
        "selectionStrategy": "weighted"
      }
    ],
    "model": "llama3.2",
    "outputVariable": "ai_response"
  }
}
```

### Required Fields

- `id`: Unique identifier for the variant
- `name`: Human-readable name for analytics
- `prompt`: The actual prompt text

### Optional Fields

- `weight`: Numeric weight for weighted selection (default: 1)
- `selectionStrategy`: Strategy for this variant set (default: "random")

## Analytics & Tracking

### Automatic Variables

When A/B testing is active, these variables are automatically set:

- `selectedPromptVariant`: Name of selected variant
- `selectedPromptVariantId`: ID of selected variant

### Conversion Tracking

Conversions are automatically tracked for:

1. **Flow Completion**: When user completes entire flow
2. **Custom Events**: Using `recordAbTestConversion()` method

### Logging

All A/B test selections and conversions are logged:

```
🔀 A/B Test selection: User 5511999999999, Strategy: weighted, Selected: Formal Tone
📊 A/B Test Conversion: User 5511999999999, Variant variant-a, Type: flow_completion
```

## Best Practices

### 1. Start Simple
- Begin with 2 variants
- Use clear, different approaches
- Test one variable at a time

### 2. Sample Size
- Run tests long enough for statistical significance
- Aim for at least 100 users per variant

### 3. Hypothesis-Driven
- Define clear success metrics
- Form hypotheses about which variant will perform better
- Document expected outcomes

### 4. Monitoring
- Check logs regularly for variant distribution
- Monitor conversion rates
- Look for unexpected patterns

## Example Use Cases

### 1. Tone Testing
- Formal vs. casual language
- Professional vs. friendly approach
- Technical vs. simplified explanations

### 2. Structure Testing
- Bullet points vs. paragraphs
- Questions vs. statements
- Long vs. short responses

### 3. CTA Testing
- Different call-to-action phrases
- Urgency vs. informational
- Direct vs. indirect requests

## Implementation Example

See `template/ab-testing-example.json` for a complete flow demonstrating:

- Weighted prompt variants
- User feedback collection
- Conversion tracking
- Retry mechanisms

## Monitoring in Grafana

A/B test data is available in the monitoring dashboard:

- Variant selection rates
- Conversion tracking
- User engagement metrics

## API Reference

### FlowExecutionService Methods

```javascript
// Select prompt variant for user
selectPromptVariant(userId, variants)

// Record conversion event
recordAbTestConversion(userId, variantId, conversionType)
```

### Selection Strategies

- `random`: Equal probability
- `weighted`: Based on variant weights
- `user_hash`: Consistent per user

## Troubleshooting

### Common Issues

1. **Inconsistent Assignment**
   - Use `user_hash` strategy for consistency
   - Check cache is working properly

2. **Uneven Distribution** 
   - Verify weights sum correctly
   - Check for selection bias

3. **No Variant Selected**
   - Ensure `promptVariants` array exists
   - Check variant structure

### Debugging

Enable verbose logging to see variant selection:

```javascript
logger.info('A/B Test selection:', { userId, strategy, selectedVariant });
```

## Migration Guide

### From Single Prompts

```json
// Before
{
  "data": {
    "prompt": "Your single prompt"
  }
}

// After
{
  "data": {
    "prompt": "Your single prompt", // fallback
    "promptVariants": [
      {
        "id": "variant-a",
        "name": "Original",
        "prompt": "Your single prompt"
      },
      {
        "id": "variant-b", 
        "name": "Alternative",
        "prompt": "New variant to test"
      }
    ]
  }
}
```

The system maintains backward compatibility with single prompts.